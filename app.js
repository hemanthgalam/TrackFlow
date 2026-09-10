// const dns = require('dns');
// dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const nunjucks = require('nunjucks');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup static folder
app.use(express.static(path.join(__dirname, 'public')));

// Parse requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Nunjucks templating (Jinja compatible syntax)
nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app,
  noCache: true // true for development, disables template caching
});

// Set HTML engine
app.set('view engine', 'html');

// --- Helper Functions for Templates ---
// Format currency or salary ranges
app.locals.formatSalary = (salary) => {
  return salary || 'N/A';
};

// Return CSS class badge for statuses
app.locals.getStatusBadgeClass = (status) => {
  switch (status.toLowerCase()) {
    case 'applied': return 'badge-applied';
    case 'interviewing': return 'badge-interviewing';
    case 'offered': return 'badge-offered';
    case 'accepted': return 'badge-accepted';
    case 'rejected': return 'badge-rejected';
    default: return 'badge-default';
  }
};

// --- Routes ---

// GET / - Redirect to Dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// GET /dashboard - Dashboard View
app.get('/dashboard', async (req, res, next) => {
  try {
    const jobs = await db.getJobs();
    
    // Calculate status statistics
    const stats = {
      total: jobs.length,
      applied: jobs.filter(j => j.status === 'Applied').length,
      interviewing: jobs.filter(j => j.status === 'Interviewing').length,
      offered: jobs.filter(j => j.status === 'Offered').length,
      accepted: jobs.filter(j => j.status === 'Accepted').length,
      rejected: jobs.filter(j => j.status === 'Rejected').length
    };

    // Funnel calculations: conversion rate (Interviewing + Offered + Accepted) / Applied
    const interviewOrFurther = jobs.filter(j => ['Interviewing', 'Offered', 'Accepted'].includes(j.status)).length;
    stats.conversionRate = stats.total > 0 ? Math.round((interviewOrFurther / stats.total) * 100) : 0;

    // Find recent updates from timelines
    const recentUpdates = [];
    jobs.forEach(job => {
      job.timeline.forEach(event => {
        recentUpdates.push({
          jobId: job.id,
          company: job.company,
          role: job.role,
          status: event.status,
          date: event.date,
          note: event.note
        });
      });
    });
    
    // Sort updates by date desc, limit to top 5
    recentUpdates.sort((a, b) => new Date(b.date) - new Date(a.date));
    const topUpdates = recentUpdates.slice(0, 5);

    // Find upcoming interviews: events containing 'interview' in note or status
    const upcomingInterviews = [];
    jobs.forEach(job => {
      if (job.status === 'Interviewing') {
        const interviewEvents = job.timeline
          .filter(event => event.note.toLowerCase().includes('interview') || event.status === 'Interviewing')
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (interviewEvents.length > 0) {
          upcomingInterviews.push({
            jobId: job.id,
            company: job.company,
            role: job.role,
            date: interviewEvents[0].date,
            details: interviewEvents[0].note
          });
        }
      }
    });

    // Sort upcoming interviews by date asc
    upcomingInterviews.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.render('dashboard', {
      title: 'Job Tracker | Dashboard',
      activePage: 'dashboard',
      stats,
      topUpdates,
      upcomingInterviews,
      recentJobs: jobs.slice(0, 3) // Already sorted desc by date_applied in db query
    });
  } catch (err) {
    next(err);
  }
});

// GET /jobs - List/Table View of Jobs
app.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await db.getJobs();
    res.render('jobs', {
      title: 'Job Tracker | Applications',
      activePage: 'jobs',
      jobs // Already sorted desc by date_applied in db
    });
  } catch (err) {
    next(err);
  }
});

// GET /kanban - Kanban Board View
app.get('/kanban', async (req, res, next) => {
  try {
    const jobs = await db.getJobs();
    
    // Group jobs by their status columns
    const columns = {
      'Applied': jobs.filter(j => j.status === 'Applied'),
      'Interviewing': jobs.filter(j => j.status === 'Interviewing'),
      'Offered': jobs.filter(j => j.status === 'Offered'),
      'Accepted': jobs.filter(j => j.status === 'Accepted'),
      'Rejected': jobs.filter(j => j.status === 'Rejected')
    };

    res.render('kanban', {
      title: 'Job Tracker | Kanban Board',
      activePage: 'kanban',
      columns
    });
  } catch (err) {
    next(err);
  }
});

// GET /jobs/new - Form to Add Job
app.get('/jobs/new', (req, res) => {
  res.render('job_form', {
    title: 'Job Tracker | Add Application',
    activePage: 'add-job',
    job: {},
    isEdit: false
  });
});

// POST /jobs - Add Job Processing
app.post('/jobs', async (req, res, next) => {
  try {
    const jobData = {
      ...req.body,
      contacts: req.body.contacts ? JSON.parse(req.body.contacts) : []
    };
    
    await db.createJob(jobData);
    res.redirect('/jobs');
  } catch (err) {
    next(err);
  }
});

// GET /jobs/:id - Job Detail View
app.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await db.getJobById(req.params.id);
    if (!job) {
      return res.status(404).render('error', { message: 'Job Application not found.' });
    }

    // Sort timeline events: newest first
    const timeline = [...job.timeline].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render('job_detail', {
      title: `Job Tracker | ${job.role} at ${job.company}`,
      activePage: 'jobs',
      job,
      timeline
    });
  } catch (err) {
    next(err);
  }
});

// GET /jobs/:id/edit - Edit Job Form
app.get('/jobs/:id/edit', async (req, res, next) => {
  try {
    const job = await db.getJobById(req.params.id);
    if (!job) {
      return res.status(404).render('error', { message: 'Job Application not found.' });
    }

    res.render('job_form', {
      title: `Job Tracker | Edit ${job.company}`,
      activePage: 'jobs',
      job,
      isEdit: true
    });
  } catch (err) {
    next(err);
  }
});

// POST /jobs/:id/edit - Process Job Edit
app.post('/jobs/:id/edit', async (req, res, next) => {
  try {
    const id = req.params.id;
    const updateData = {
      ...req.body,
      contacts: req.body.contacts ? JSON.parse(req.body.contacts) : []
    };

    await db.updateJob(id, updateData);
    res.redirect(`/jobs/${id}`);
  } catch (err) {
    next(err);
  }
});

// POST /jobs/:id/status - Update Status via API/Fetch
app.post('/jobs/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status, note } = req.body;

    if (!['Applied', 'Interviewing', 'Offered', 'Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedJob = await db.updateJob(id, {
      status,
      timelineNote: note || `Status updated via board drag-and-drop.`
    });

    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ success: true, job: updatedJob });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /jobs/:id/timeline - Add timeline event manually
app.post('/jobs/:id/timeline', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { date, status, note } = req.body;

    await db.addTimelineEvent(id, date, status, note);
    res.redirect(`/jobs/${id}`);
  } catch (err) {
    next(err);
  }
});

// POST /jobs/:id/delete - Delete Application
app.post('/jobs/:id/delete', async (req, res, next) => {
  try {
    const success = await db.deleteJob(req.params.id);
    if (!success) {
      return res.status(404).render('error', { message: 'Failed to delete application.' });
    }
    res.redirect('/jobs');
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { title: '404 - Not Found', message: 'The page you are looking for does not exist.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('error', { 
    title: '500 - Server Error', 
    message: err.message || 'An unexpected error occurred on the server.' 
  });
});

// Initialize database schema first, then boot server
db.initializeDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal: Failed to initialize PostgreSQL database. Server not started.', err);
    process.exit(1);
  });

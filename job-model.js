// Storage-agnostic helpers shared by the Postgres/JSON backend (db.js)
// and the Cloudflare D1 backend (db-d1.js).
const { v4: uuidv4 } = require('uuid');

const today = () => new Date().toISOString().split('T')[0];

// Build a brand new job record from submitted form data
function buildNewJob(jobData) {
  const now = today();
  return {
    id: uuidv4(),
    company: jobData.company || 'Unnamed Company',
    role: jobData.role || 'Software Engineer',
    status: jobData.status || 'Applied',
    dateApplied: jobData.dateApplied || now,
    url: jobData.url || '',
    salary: jobData.salary || '',
    location: jobData.location || '',
    type: jobData.type || 'Full-time',
    workplace: jobData.workplace || 'Remote',
    notes: jobData.notes || '',
    contacts: jobData.contacts || [],
    timeline: [
      {
        id: uuidv4(),
        date: jobData.dateApplied || now,
        status: jobData.status || 'Applied',
        note: jobData.timelineNote || 'Application tracked.'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Merge an update into an existing job, appending a timeline event on status change
function applyJobUpdate(currentJob, updateData) {
  const oldStatus = currentJob.status;
  const newStatus = updateData.status || currentJob.status;
  const pick = (key) => (updateData[key] !== undefined ? updateData[key] : currentJob[key]);

  const updatedJob = {
    ...currentJob,
    company: pick('company'),
    role: pick('role'),
    status: newStatus,
    dateApplied: pick('dateApplied'),
    url: pick('url'),
    salary: pick('salary'),
    location: pick('location'),
    type: pick('type'),
    workplace: pick('workplace'),
    notes: pick('notes'),
    contacts: pick('contacts'),
    timeline: [...currentJob.timeline],
    updatedAt: new Date().toISOString()
  };

  if (oldStatus !== newStatus) {
    updatedJob.timeline.push({
      id: uuidv4(),
      date: today(),
      status: newStatus,
      note: updateData.timelineNote || `Status updated from ${oldStatus} to ${newStatus}.`
    });
  }
  return updatedJob;
}

// Build the timeline list with one manually added event appended
function appendTimelineEvent(job, date, status, note) {
  return [...job.timeline, {
    id: uuidv4(),
    date: date || today(),
    status: status || job.status,
    note: note || 'Timeline event recorded.'
  }];
}

module.exports = { buildNewJob, applyJobUpdate, appendTimelineEvent };

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');

let isLocalStorage = false;
let pool = null;

// Default Seed Data for Local File Mode
const SEED_JOBS = [
  {
    id: "c76f6291-766a-4d2b-b6d3-2f8087ab92c1",
    company: "Stripe",
    role: "Senior Frontend Engineer",
    status: "Interviewing",
    dateApplied: "2026-08-15",
    url: "https://stripe.com/jobs/senior-frontend-engineer",
    salary: "$160,000 - $190,000",
    location: "San Francisco, CA",
    type: "Full-time",
    workplace: "Hybrid",
    notes: "Spoke to recruiter Sarah. Preparing heavily on web performance and React rendering optimization.",
    contacts: [{ name: "Sarah Jenkins", email: "sarah.j@stripe.com", phone: "+1 (555) 019-2834", role: "Recruiter" }],
    timeline: [
      { id: "t1", date: "2026-08-15", status: "Applied", note: "Applied via employee referral." },
      { id: "t2", date: "2026-08-20", status: "Interviewing", note: "Completed recruiter phone screen." }
    ],
    createdAt: "2026-08-15T14:32:00.000Z",
    updatedAt: "2026-08-28T16:45:00.000Z"
  },
  {
    id: "f5e4d3c2-b1a0-9f8e-7d6c-5b4a3f2e1d0c",
    company: "Google",
    role: "UX Engineer",
    status: "Offered",
    dateApplied: "2026-07-28",
    url: "https://careers.google.com",
    salary: "$180,000 - $210,000",
    location: "Mountain View, CA",
    type: "Full-time",
    workplace: "On-site",
    notes: "Offer received, reviewing stock package details.",
    contacts: [{ name: "Marcus Aurelius", email: "marcus.a@google.com", role: "Lead Recruiter" }],
    timeline: [
      { id: "g1", date: "2026-07-28", status: "Applied", note: "Applied through careers portal." },
      { id: "g2", date: "2026-08-26", status: "Offered", note: "Verbal offer extended by recruiter!" }
    ],
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-08-26T18:30:00.000Z"
  }
];

function initLocalFileDb() {
  isLocalStorage = true;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_JOBS, null, 2), 'utf8');
  }
}

function getLocalJobs() {
  initLocalFileDb();
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveLocalJobs(jobs) {
  initLocalFileDb();
  fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2), 'utf8');
}

// Helper to map DB row to template friendly camelCase object
function mapRow(row) {
  if (!row) return null;
  let dateAppliedStr = '';
  if (row.date_applied) {
    const d = new Date(row.date_applied);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateAppliedStr = `${year}-${month}-${day}`;
  }

  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    dateApplied: dateAppliedStr,
    url: row.url || '',
    salary: row.salary || '',
    location: row.location || '',
    type: row.type || 'Full-time',
    workplace: row.workplace || 'Remote',
    notes: row.notes || '',
    contacts: row.contacts || [],
    timeline: row.timeline || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Initialize DB with automatic fallback to local JSON file
async function initializeDb() {
  if (process.env.USE_LOCAL_STORAGE === 'true') {
    console.log('USE_LOCAL_STORAGE=true. Initializing local JSON file database...');
    initLocalFileDb();
    return true;
  }

  const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'jobtracker',
      };

  if (!process.env.DATABASE_URL && process.env.PGHOST && (process.env.PGHOST.includes('supabase') || process.env.PGHOST !== 'localhost')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  try {
    pool = new Pool(poolConfig);
    console.log(`Connecting to Postgres (${poolConfig.host || 'connectionString'})...`);
    const client = await pool.connect();
    console.log('Connected to Postgres successfully!');
    
    const createSchemaSql = `
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY,
        company VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        date_applied DATE NOT NULL,
        url TEXT,
        salary VARCHAR(100),
        location VARCHAR(255),
        type VARCHAR(50),
        workplace VARCHAR(50),
        notes TEXT,
        contacts JSONB DEFAULT '[]'::jsonb,
        timeline JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createSchemaSql);
    console.log('Postgres schema verified.');
    client.release();
    return true;
  } catch (err) {
    console.warn(`Postgres connection failed (${err.message}). Falling back to local JSON file storage.`);
    initLocalFileDb();
    return true;
  }
}

// Get all jobs
async function getJobs() {
  if (isLocalStorage) {
    return getLocalJobs().sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied));
  }
  const result = await pool.query('SELECT * FROM jobs ORDER BY date_applied DESC');
  return result.rows.map(mapRow);
}

// Get job by ID
async function getJobById(id) {
  if (isLocalStorage) {
    return getLocalJobs().find(j => j.id === id) || null;
  }
  const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

// Create a new job application
async function createJob(jobData) {
  const now = new Date().toISOString().split('T')[0];
  const newJob = {
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

  if (isLocalStorage) {
    const jobs = getLocalJobs();
    jobs.push(newJob);
    saveLocalJobs(jobs);
    return newJob;
  }

  const insertSql = `
    INSERT INTO jobs (id, company, role, status, date_applied, url, salary, location, type, workplace, notes, contacts, timeline)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
    RETURNING *
  `;
  const result = await pool.query(insertSql, [
    newJob.id, newJob.company, newJob.role, newJob.status, newJob.dateApplied, newJob.url, newJob.salary,
    newJob.location, newJob.type, newJob.workplace, newJob.notes, JSON.stringify(newJob.contacts), JSON.stringify(newJob.timeline)
  ]);
  return mapRow(result.rows[0]);
}

// Update existing job application
async function updateJob(id, updateData) {
  const currentJob = await getJobById(id);
  if (!currentJob) return null;

  const oldStatus = currentJob.status;
  const newStatus = updateData.status || currentJob.status;
  const nowStr = new Date().toISOString().split('T')[0];

  const updatedJob = {
    ...currentJob,
    company: updateData.company !== undefined ? updateData.company : currentJob.company,
    role: updateData.role !== undefined ? updateData.role : currentJob.role,
    status: newStatus,
    dateApplied: updateData.dateApplied !== undefined ? updateData.dateApplied : currentJob.dateApplied,
    url: updateData.url !== undefined ? updateData.url : currentJob.url,
    salary: updateData.salary !== undefined ? updateData.salary : currentJob.salary,
    location: updateData.location !== undefined ? updateData.location : currentJob.location,
    type: updateData.type !== undefined ? updateData.type : currentJob.type,
    workplace: updateData.workplace !== undefined ? updateData.workplace : currentJob.workplace,
    notes: updateData.notes !== undefined ? updateData.notes : currentJob.notes,
    contacts: updateData.contacts !== undefined ? updateData.contacts : currentJob.contacts,
    updatedAt: new Date().toISOString()
  };

  if (oldStatus !== newStatus) {
    updatedJob.timeline.push({
      id: uuidv4(),
      date: nowStr,
      status: newStatus,
      note: updateData.timelineNote || `Status updated from ${oldStatus} to ${newStatus}.`
    });
  }

  if (isLocalStorage) {
    const jobs = getLocalJobs();
    const idx = jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      jobs[idx] = updatedJob;
      saveLocalJobs(jobs);
    }
    return updatedJob;
  }

  const updateSql = `
    UPDATE jobs 
    SET company = $1, role = $2, status = $3, date_applied = $4, url = $5, 
        salary = $6, location = $7, type = $8, workplace = $9, notes = $10, 
        contacts = $11::jsonb, timeline = $12::jsonb, updated_at = NOW()
    WHERE id = $13
    RETURNING *
  `;
  const result = await pool.query(updateSql, [
    updatedJob.company, updatedJob.role, updatedJob.status, updatedJob.dateApplied, updatedJob.url,
    updatedJob.salary, updatedJob.location, updatedJob.type, updatedJob.workplace, updatedJob.notes,
    JSON.stringify(updatedJob.contacts), JSON.stringify(updatedJob.timeline), id
  ]);
  return mapRow(result.rows[0]);
}

// Add timeline event
async function addTimelineEvent(id, date, status, note) {
  const job = await getJobById(id);
  if (!job) return null;

  const nowStr = new Date().toISOString().split('T')[0];
  const newTimeline = [...job.timeline, {
    id: uuidv4(),
    date: date || nowStr,
    status: status || job.status,
    note: note || 'Timeline event recorded.'
  }];

  if (isLocalStorage) {
    job.timeline = newTimeline;
    job.updatedAt = new Date().toISOString();
    const jobs = getLocalJobs();
    const idx = jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      jobs[idx] = job;
      saveLocalJobs(jobs);
    }
    return job;
  }

  const updateSql = `UPDATE jobs SET timeline = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`;
  const result = await pool.query(updateSql, [JSON.stringify(newTimeline), id]);
  return mapRow(result.rows[0]);
}

// Delete job application
async function deleteJob(id) {
  if (isLocalStorage) {
    const jobs = getLocalJobs();
    const filtered = jobs.filter(j => j.id !== id);
    if (filtered.length === jobs.length) return false;
    saveLocalJobs(filtered);
    return true;
  }
  const result = await pool.query('DELETE FROM jobs WHERE id = $1', [id]);
  return result.rowCount > 0;
}

module.exports = {
  initializeDb,
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  addTimelineEvent
};

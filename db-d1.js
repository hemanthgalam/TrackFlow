// Cloudflare D1 (SQLite) storage backend. Exposes the same functions as db.js
// so create-app.js routes work unchanged. Schema lives in migrations/.
const { buildNewJob, applyJobUpdate, appendTimelineEvent } = require('./job-model');

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : [];
  } catch (e) {
    return [];
  }
}

// Map a D1 row to the template friendly camelCase object
function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    dateApplied: row.date_applied || '',
    url: row.url || '',
    salary: row.salary || '',
    location: row.location || '',
    type: row.type || 'Full-time',
    workplace: row.workplace || 'Remote',
    notes: row.notes || '',
    contacts: parseJson(row.contacts),
    timeline: parseJson(row.timeline),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createD1Db(d1) {
  async function getJobs() {
    const { results } = await d1.prepare('SELECT * FROM jobs ORDER BY date_applied DESC').all();
    return results.map(mapRow);
  }

  async function getJobById(id) {
    return mapRow(await d1.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first());
  }

  async function createJob(jobData) {
    const job = buildNewJob(jobData);
    const row = await d1.prepare(`
      INSERT INTO jobs (id, company, role, status, date_applied, url, salary, location, type, workplace, notes, contacts, timeline, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      job.id, job.company, job.role, job.status, job.dateApplied, job.url, job.salary, job.location,
      job.type, job.workplace, job.notes, JSON.stringify(job.contacts), JSON.stringify(job.timeline),
      job.createdAt, job.updatedAt
    ).first();
    return mapRow(row);
  }

  async function updateJob(id, updateData) {
    const currentJob = await getJobById(id);
    if (!currentJob) return null;

    const job = applyJobUpdate(currentJob, updateData);
    const row = await d1.prepare(`
      UPDATE jobs
      SET company = ?, role = ?, status = ?, date_applied = ?, url = ?, salary = ?, location = ?,
          type = ?, workplace = ?, notes = ?, contacts = ?, timeline = ?, updated_at = ?
      WHERE id = ?
      RETURNING *
    `).bind(
      job.company, job.role, job.status, job.dateApplied, job.url, job.salary, job.location,
      job.type, job.workplace, job.notes, JSON.stringify(job.contacts), JSON.stringify(job.timeline),
      job.updatedAt, id
    ).first();
    return mapRow(row);
  }

  async function addTimelineEvent(id, date, status, note) {
    const job = await getJobById(id);
    if (!job) return null;

    const timeline = appendTimelineEvent(job, date, status, note);
    const row = await d1.prepare('UPDATE jobs SET timeline = ?, updated_at = ? WHERE id = ? RETURNING *')
      .bind(JSON.stringify(timeline), new Date().toISOString(), id)
      .first();
    return mapRow(row);
  }

  async function deleteJob(id) {
    const result = await d1.prepare('DELETE FROM jobs WHERE id = ?').bind(id).run();
    return result.meta.changes > 0;
  }

  return { getJobs, getJobById, createJob, updateJob, deleteJob, addTimelineEvent };
}

module.exports = { createD1Db };

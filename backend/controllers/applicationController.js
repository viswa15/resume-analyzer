// backend/controllers/applicationController.js
const db = require('../db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const getOwnedApplication = async (id, userId) => {
  const { rows } = await db.query(
    'SELECT * FROM applications WHERE id = $1 AND user_id = $2;',
    [id, userId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Application not found.');
  }
  return rows[0];
};

/**
 * Lists the authenticated user's tracked applications, newest first.
 * Optional `status` query param filters to a single status column value.
 */
const getAllApplications = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const params = [req.user.id];
  let whereClause = 'WHERE user_id = $1';

  if (status) {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT * FROM applications ${whereClause} ORDER BY updated_at DESC, created_at DESC;`,
    params
  );

  res.status(200).json({ data: rows });
});

/**
 * Creates a new tracked application for the authenticated user. `resumeId`,
 * when supplied, is only accepted if it belongs to the same user (checked
 * via the resumes table's own user_id column, not just cast blindly).
 */
const createApplication = asyncHandler(async (req, res) => {
  const { company, roleTitle, jobUrl, status, notes, appliedAt, resumeId } = req.body;

  let ownedResumeId = null;
  if (resumeId) {
    const { rows } = await db.query('SELECT id FROM resumes WHERE id = $1 AND user_id = $2;', [resumeId, req.user.id]);
    if (rows.length === 0) {
      throw new ApiError(404, 'The referenced resume was not found.');
    }
    ownedResumeId = rows[0].id;
  }

  const { rows } = await db.query(
    `INSERT INTO applications (user_id, resume_id, company, role_title, job_url, status, notes, applied_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'saved'), $7, $8)
     RETURNING *;`,
    [req.user.id, ownedResumeId, company, roleTitle, jobUrl || null, status, notes || null, appliedAt || null]
  );

  res.status(201).json(rows[0]);
});

/**
 * Updates fields on a tracked application, scoped to its owner. Any subset
 * of fields may be sent (the validator makes every field optional); columns
 * left out of the request keep their current value via COALESCE.
 */
const updateApplication = asyncHandler(async (req, res) => {
  const existing = await getOwnedApplication(req.params.id, req.user.id);
  const { company, roleTitle, jobUrl, status, notes, appliedAt } = req.body;

  const { rows } = await db.query(
    `UPDATE applications SET
       company = COALESCE($1, company),
       role_title = COALESCE($2, role_title),
       job_url = COALESCE($3, job_url),
       status = COALESCE($4, status),
       notes = COALESCE($5, notes),
       applied_at = COALESCE($6, applied_at),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 AND user_id = $8
     RETURNING *;`,
    [company, roleTitle, jobUrl, status, notes, appliedAt, existing.id, req.user.id]
  );

  res.status(200).json(rows[0]);
});

/**
 * Deletes a tracked application, scoped to its owner.
 */
const deleteApplication = asyncHandler(async (req, res) => {
  await getOwnedApplication(req.params.id, req.user.id);
  await db.query('DELETE FROM applications WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
  res.status(204).send();
});

module.exports = { getAllApplications, createApplication, updateApplication, deleteApplication };

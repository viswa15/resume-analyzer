// backend/controllers/jobController.js
//
// Resume-optional job search. GET /resumes/:id/jobs (resumeController.js)
// always requires an owned resume and always ranks against it - that's
// still the deep link from a resume's dossier page. This controller backs
// a separate, standalone search: no resume required at all, because a
// signed-in user might be searching for someone else (a friend, a family
// member) rather than matching their own resume. An optional `resumeId`
// query param opts back into the same experience-fit/skill-score ranking
// when the caller does want to search against one of their own resumes.
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { findJobsForResume } = require('../services/adzunaService');

const EMPLOYMENT_TYPES = new Set(['full_time', 'part_time', 'contract', 'permanent']);

/**
 * Parses a query param expected to be a positive integer (maxDaysOld,
 * salaryMin, salaryMax). Anything absent, non-numeric, or non-positive is
 * treated as "not filtering on this" rather than an error.
 */
const parsePositiveIntParam = (value) => {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Looks up a resume by id, scoped to the signed-in user. Unlike
 * resumeController's getOwnedResume, this returns null instead of
 * throwing a 404 - here resumeId is just an optional ranking hint, not a
 * required resource, and an unknown or foreign id should silently fall
 * back to an unranked search rather than fail the whole request. This also
 * avoids leaking whether a given resume id exists/belongs to someone else.
 */
const findOwnedResumeOrNull = async (resumeId, userId) => {
  if (!resumeId) return null;
  const { rows } = await db.query(
    'SELECT * FROM resumes WHERE id = $1 AND user_id = $2;',
    [resumeId, userId],
  );
  return rows[0] || null;
};

/**
 * GET /api/jobs/search
 * Query params: what, where, maxDaysOld, salaryMin, salaryMax,
 * employmentType, resumeId (all optional).
 */
const searchJobs = asyncHandler(async (req, res) => {
  const what = typeof req.query.what === 'string' ? req.query.what.trim() : undefined;
  const where = typeof req.query.where === 'string' ? req.query.where.trim() : undefined;
  const maxDaysOld = parsePositiveIntParam(req.query.maxDaysOld);
  const salaryMin = parsePositiveIntParam(req.query.salaryMin);
  const salaryMax = parsePositiveIntParam(req.query.salaryMax);
  const employmentType = typeof req.query.employmentType === 'string' && EMPLOYMENT_TYPES.has(req.query.employmentType)
    ? req.query.employmentType
    : undefined;
  const resumeId = typeof req.query.resumeId === 'string' ? req.query.resumeId.trim() : undefined;

  const resume = await findOwnedResumeOrNull(resumeId, req.user.id);

  const { jobs, candidateExperienceYears } = await findJobsForResume(resume, {
    what: what || undefined,
    where: where || undefined,
    maxDaysOld,
    salaryMin,
    salaryMax,
    employmentType,
  });
  res.status(200).json({ data: jobs, candidateExperienceYears, matchedResumeId: resume ? resume.id : null });
});

module.exports = { searchJobs };

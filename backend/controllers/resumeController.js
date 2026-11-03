// backend/controllers/resumeController.js
const db = require('../db');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { parsePdf, analyzeResumeWithAI } = require('../services/analysisService');
const { matchResumeToJob } = require('../services/jdMatchService');
const { answerQuestionAboutResume, streamAnswerAboutResume } = require('../services/chatService');
const { rewriteBulletPoint } = require('../services/rewriteService');
const { findJobsForResume } = require('../services/adzunaService');
const { generateCoverLetter } = require('../services/coverLetterService');
const { analyzeAts } = require('../services/atsService');
const { tailorResume } = require('../services/tailorService');
const { renderResumePdf } = require('../services/pdfService');

const MAX_HISTORY_MESSAGES = 10;

const getOwnedResume = async (resumeId, userId) => {
  const { rows } = await db.query(
    'SELECT * FROM resumes WHERE id = $1 AND user_id = $2;',
    [resumeId, userId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Resume not found.');
  }
  return rows[0];
};

/**
 * Handles the resume upload, parsing, analysis, and database insertion.
 * The resume is always attached to the authenticated user.
 */
const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Please upload a PDF file.');
  }

  const resumeText = await parsePdf(req.file.buffer);
  if (!resumeText || resumeText.trim().length < 30) {
    throw new ApiError(422, 'Could not extract readable text from this PDF. Is it a scanned image?');
  }

  const analysisData = await analyzeResumeWithAI(resumeText);
  const fileName = req.file.originalname;

  const {
    name, email, phone, linkedin_url, portfolio_url, summary,
    work_experience, education, technical_skills, soft_skills,
    projects, certifications, resume_rating, improvement_areas, upskill_suggestions
  } = analysisData;

  const query = `
    INSERT INTO resumes (
      file_name, user_id, resume_text, name, email, phone, linkedin_url, portfolio_url,
      summary, work_experience, education, technical_skills, soft_skills, projects,
      certifications, resume_rating, improvement_areas, upskill_suggestions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *;
  `;

  const values = [
    fileName, req.user.id, resumeText, name, email, phone, linkedin_url, portfolio_url, summary,
    JSON.stringify(work_experience || []),
    JSON.stringify(education || []),
    JSON.stringify(technical_skills || []),
    JSON.stringify(soft_skills || []),
    JSON.stringify(projects || []),
    JSON.stringify(certifications || []),
    resume_rating, improvement_areas,
    JSON.stringify(upskill_suggestions || [])
  ];

  const { rows } = await db.query(query, values);
  res.status(201).json(rows[0]);
});

/**
 * Fetches a paginated, searchable list of the authenticated user's resumes.
 * Query params: page (default 1), limit (default 10, max 50), q (search text).
 */
const getAllResumes = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const offset = (page - 1) * limit;
  const search = (req.query.q || '').trim();

  const params = [req.user.id];
  let whereClause = 'WHERE user_id = $1';

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (file_name ILIKE $${params.length} OR name ILIKE $${params.length} OR email ILIKE $${params.length})`;
  }

  const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM resumes ${whereClause};`, params);
  const total = countResult.rows[0].total;

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT id, file_name, name, email, uploaded_at, resume_rating
     FROM resumes ${whereClause}
     ORDER BY uploaded_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length};`,
    params
  );

  res.status(200).json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
});

/**
 * Fetches a single resume by its ID, scoped to the authenticated owner.
 */
const getResumeById = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  res.status(200).json(resume);
});

/**
 * Compares a stored resume against a pasted job description.
 */
const matchJobDescription = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const { jobDescription } = req.body;
  const result = await matchResumeToJob(resume.resume_text || resume.summary || '', jobDescription);

  // Best-effort history record (powers the Insights page). A failure here must
  // never hide a match result the user just waited for.
  try {
    const score = Math.max(0, Math.min(100, Math.round(Number(result.match_score) || 0)));
    await db.query(
      `INSERT INTO match_history (user_id, resume_id, match_score, job_snippet, missing_keywords)
       VALUES ($1, $2, $3, $4, $5);`,
      [req.user.id, resume.id, score, jobDescription.trim().replace(/\s+/g, ' ').slice(0, 160), JSON.stringify(result.missing_keywords || [])]
    );
  } catch (err) {
    logger.warn(`Could not record match history: ${err.message}`);
  }

  res.status(200).json(result);
});

/**
 * Returns the stored chat history for a resume.
 */
const getChatHistory = asyncHandler(async (req, res) => {
  await getOwnedResume(req.params.id, req.user.id);
  const { rows } = await db.query(
    'SELECT id, role, content, created_at FROM chat_messages WHERE resume_id = $1 ORDER BY created_at ASC;',
    [req.params.id]
  );
  res.status(200).json(rows);
});

/**
 * Asks a question about a resume, grounded in its text, and persists the exchange.
 */
const postChatMessage = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const { question } = req.body;

  const { rows: historyRows } = await db.query(
    'SELECT role, content FROM chat_messages WHERE resume_id = $1 ORDER BY created_at DESC LIMIT $2;',
    [req.params.id, MAX_HISTORY_MESSAGES]
  );
  const history = historyRows.reverse();

  const answer = await answerQuestionAboutResume(resume.resume_text || resume.summary || '', question, history);

  await db.query(
    `INSERT INTO chat_messages (resume_id, user_id, role, content)
     VALUES ($1, $2, 'user', $3), ($1, $2, 'assistant', $4);`,
    [req.params.id, req.user.id, question, answer]
  );

  res.status(200).json({ answer });
});

/**
 * Streaming variant of postChatMessage using Server-Sent Events. Events:
 *   data: {"delta": "..."}              - a piece of the answer as it is generated
 *   event: done  data: {"answer": ...}  - the complete answer (already saved)
 *   event: error data: {"error": ...}   - the stream failed; nothing was saved
 * Ownership is checked BEFORE the stream opens, so a missing/foreign resume is
 * still a normal JSON 404. Nothing is persisted if the client disconnects early.
 */
const streamChatMessage = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const { question } = req.body;

  const { rows: historyRows } = await db.query(
    'SELECT role, content FROM chat_messages WHERE resume_id = $1 ORDER BY created_at DESC LIMIT $2;',
    [req.params.id, MAX_HISTORY_MESSAGES]
  );
  const history = historyRows.reverse();

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop nginx-style proxies from buffering the stream
  });
  res.flushHeaders();

  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) clientGone = true;
  });
  const send = (payload, event) => {
    if (clientGone) return;
    res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const answer = await streamAnswerAboutResume(
      resume.resume_text || resume.summary || '',
      question,
      history,
      (delta) => send({ delta })
    );

    if (!clientGone && answer) {
      await db.query(
        `INSERT INTO chat_messages (resume_id, user_id, role, content)
         VALUES ($1, $2, 'user', $3), ($1, $2, 'assistant', $4);`,
        [req.params.id, req.user.id, question, answer]
      );
    }
    send({ answer }, 'done');
  } catch (err) {
    logger.error(`Chat stream failed: ${err.message}`);
    send({ error: err.statusCode ? err.message : 'The assistant could not finish that answer. Please try again.' }, 'error');
  } finally {
    res.end();
  }
});

/**
 * Rewrites a single bullet point. Stateless - not tied to a specific stored resume.
 */
const rewriteBullet = asyncHandler(async (req, res) => {
  const { bullet, role } = req.body;
  const result = await rewriteBulletPoint(bullet, role);
  res.status(200).json(result);
});

/**
 * Finds and ranks live job postings (via Adzuna) against a stored resume's
 * skills. Optional `what`/`where` query params override the auto-derived
 * search terms (which default to the resume's top technical skills).
 */
const EMPLOYMENT_TYPES = new Set(['full_time', 'part_time', 'contract', 'permanent']);

/**
 * Parses a query param expected to be a positive integer (e.g. maxDaysOld,
 * salaryMin, salaryMax). Anything absent, non-numeric, or non-positive is
 * treated as "not filtering on this" rather than an error - a malformed
 * filter value should just fall back to unfiltered, not break the search.
 */
const parsePositiveIntParam = (value) => {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const searchJobsForResume = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const what = typeof req.query.what === 'string' ? req.query.what.trim() : undefined;
  const where = typeof req.query.where === 'string' ? req.query.where.trim() : undefined;
  const maxDaysOld = parsePositiveIntParam(req.query.maxDaysOld);
  const salaryMin = parsePositiveIntParam(req.query.salaryMin);
  const salaryMax = parsePositiveIntParam(req.query.salaryMax);
  const employmentType = typeof req.query.employmentType === 'string' && EMPLOYMENT_TYPES.has(req.query.employmentType)
    ? req.query.employmentType
    : undefined;
  const { jobs, candidateExperienceYears } = await findJobsForResume(resume, {
    what: what || undefined,
    where: where || undefined,
    maxDaysOld,
    salaryMin,
    salaryMax,
    employmentType,
  });
  res.status(200).json({ data: jobs, candidateExperienceYears });
});

/**
 * Drafts a cover letter tailored to a pasted job description, grounded in
 * the resume's actual stored text.
 */
const generateResumeCoverLetter = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const { jobDescription, companyName, tone } = req.body;
  const coverLetter = await generateCoverLetter(resume.resume_text || resume.summary || '', jobDescription, { companyName, tone });
  res.status(200).json({ coverLetter });
});

/**
 * Deterministic ATS readiness check (no LLM call). Optionally measures keyword
 * coverage against a pasted job description.
 */
const checkAts = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const report = analyzeAts(resume, { jobDescription: req.body && req.body.jobDescription });
  res.status(200).json(report);
});

/**
 * Rewrites the resume for a job description (one Gemini call) and reports how the
 * ATS score and keyword coverage change (deterministic, no extra calls).
 */
const tailorResumeForJob = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const result = await tailorResume(resume, req.body.jobDescription);
  res.status(200).json(result);
});

/**
 * Renders a (possibly user-edited) tailored document as a PDF. No LLM call.
 */
const downloadTailoredPdf = asyncHandler(async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user.id);
  const pdf = await renderResumePdf(req.body.document);
  const base = String(req.body.document.contact.name || resume.name || 'resume')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'resume';
  res.status(200).set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${base}-tailored.pdf"`,
    'Content-Length': pdf.length,
  });
  res.end(pdf);
});

/**
 * Deletes a stored resume, scoped to the authenticated owner. Chat messages for
 * this resume cascade-delete automatically (chat_messages.resume_id has
 * ON DELETE CASCADE), so nothing extra needs to happen here.
 */
const deleteResume = asyncHandler(async (req, res) => {
  await getOwnedResume(req.params.id, req.user.id);
  await db.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
  res.status(204).send();
});

module.exports = {
  uploadResume,
  getAllResumes,
  getResumeById,
  matchJobDescription,
  getChatHistory,
  postChatMessage,
  streamChatMessage,
  rewriteBullet,
  deleteResume,
  searchJobsForResume,
  generateResumeCoverLetter,
  checkAts,
  tailorResumeForJob,
  downloadTailoredPdf,
};

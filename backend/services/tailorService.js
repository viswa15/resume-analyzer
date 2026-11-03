// backend/services/tailorService.js
//
// Rewrites a stored resume for one specific job description with a SINGLE
// Gemini call, then post-processes the result so the model can only change
// wording, never facts: contact details always come from the stored resume,
// and role/company/duration are restored from the original whenever the model
// returned the same number of jobs. The tailored document is then compared with
// the original using the deterministic ATS checker (no extra LLM calls).
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { buildModelChain, generateWithRetry } = require('../utils/geminiClient');
const { analyzeAts } = require('./atsService');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const modelChain = buildModelChain(genAI, { responseMimeType: 'application/json', maxOutputTokens: 8192 });

const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());
const asStrings = (value) => asArray(value).map(asText).filter(Boolean);

/**
 * Coerces whatever the model returned into the exact document shape the PDF
 * renderer and the frontend expect, restoring immutable facts from the stored
 * resume. Exported for unit tests.
 * @param {object} raw - parsed model output
 * @param {object} resume - the stored `resumes` row
 */
const normalizeTailored = (raw, resume) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const originalJobs = asArray(resume.work_experience);
  const modelJobs = asArray(source.work_experience);
  const sameShape = originalJobs.length > 0 && originalJobs.length === modelJobs.length;

  const workExperience = modelJobs.map((job, i) => {
    const original = sameShape ? originalJobs[i] || {} : {};
    return {
      role: asText(sameShape ? original.role : job && job.role),
      company: asText(sameShape ? original.company : job && job.company),
      duration: asText(sameShape ? original.duration : job && job.duration),
      bullets: asStrings((job && (job.bullets || job.description)) || []),
    };
  });

  const education = asArray(resume.education).map((e) => ({
    degree: asText(e && e.degree),
    institution: asText(e && e.institution),
    year: asText(e && e.graduation_year),
  }));

  // Projects and certifications are kept as stored unless the model returned
  // usable versions; contact details are never taken from the model.
  const projects = asArray(source.projects).length
    ? asArray(source.projects).map((p) => ({
        name: asText(p && p.name),
        description: asText(p && p.description),
        technologies: asStrings(p && p.technologies),
      }))
    : asArray(resume.projects).map((p) => ({
        name: asText(p && p.name),
        description: asText(p && p.description),
        technologies: asStrings(p && p.technologies),
      }));

  return {
    contact: {
      name: asText(resume.name),
      email: asText(resume.email),
      phone: asText(resume.phone),
      linkedin: asText(resume.linkedin_url),
      portfolio: asText(resume.portfolio_url),
    },
    headline: asText(source.headline),
    summary: asText(source.summary),
    skills: asStrings(source.skills).length ? asStrings(source.skills) : asStrings(resume.technical_skills),
    work_experience: workExperience,
    education,
    projects,
    certifications: asStrings(source.certifications).length ? asStrings(source.certifications) : asStrings(resume.certifications),
    changes: asStrings(source.changes).slice(0, 8),
  };
};

/** Flattens a tailored document into plain text with standard headings, for ATS scoring. */
const tailoredToText = (doc) => {
  const lines = [doc.contact.name, [doc.contact.email, doc.contact.phone, doc.contact.linkedin].filter(Boolean).join(' | ')];
  if (doc.summary) lines.push('Summary', doc.summary);
  if (doc.work_experience.length) {
    lines.push('Experience');
    for (const job of doc.work_experience) {
      lines.push(`${job.role} - ${job.company} (${job.duration})`, ...job.bullets.map((b) => `- ${b}`));
    }
  }
  if (doc.education.length) lines.push('Education', ...doc.education.map((e) => `${e.degree}, ${e.institution} ${e.year}`.trim()));
  if (doc.skills.length) lines.push('Skills', doc.skills.join(', '));
  if (doc.projects.length) {
    lines.push('Projects');
    for (const p of doc.projects) lines.push(`${p.name}: ${p.description} ${p.technologies.join(', ')}`.trim());
  }
  return lines.filter(Boolean).join('\n');
};

/** Runs the deterministic ATS checker on a tailored document, shaped like a stored resume. */
const scoreTailored = (doc, jobDescription) =>
  analyzeAts(
    {
      resume_text: tailoredToText(doc),
      email: doc.contact.email,
      phone: doc.contact.phone,
      linkedin_url: doc.contact.linkedin,
      technical_skills: doc.skills,
      soft_skills: [],
      work_experience: doc.work_experience.map((j) => ({ description: j.bullets })),
    },
    { jobDescription }
  );

const summariseAts = (report) => ({
  atsScore: report.score,
  keywordPercent: report.keywordCoverage ? report.keywordCoverage.percent : null,
  missingKeywords: report.keywordCoverage ? report.keywordCoverage.missing : [],
});

/**
 * @param {object} resume - stored resume row
 * @param {string} jobDescription
 * @returns {Promise<{ document: object, comparison: { before: object, after: object } }>}
 */
const tailorResume = async (resume, jobDescription) => {
  const prompt = `
    You are an expert resume writer tailoring ONE candidate's resume to ONE job description.

    STRICT RULES:
    - Use ONLY facts that appear in the RESUME below. Never invent employers, job titles, dates,
      degrees, skills, tools, or metrics. Do not add a number that is not already in the resume.
    - Keep every job, in the same order. You may reword bullets so they use the job description's
      terminology where it is TRUTHFUL, lead with strong action verbs, and put the most relevant
      accomplishments first. Keep 3-6 bullets per job.
    - Reorder "skills" so the ones the job description asks for come first. Only include skills
      already present in the resume.
    - "summary": 2-3 sentences aimed at this role, using only resume facts.
    - "changes": 3-6 short plain-English notes on what you changed and why.
    - Return ONLY a valid JSON object, no markdown.

    RESUME:
    """
    ${resume.resume_text || resume.summary || ''}
    """

    JOB DESCRIPTION:
    """
    ${jobDescription}
    """

    JSON structure to follow exactly:
    {
      "headline": "string (a short professional headline for this role)",
      "summary": "string",
      "skills": ["string"],
      "work_experience": [{ "role": "string", "company": "string", "duration": "string", "bullets": ["string"] }],
      "projects": [{ "name": "string", "description": "string", "technologies": ["string"] }],
      "certifications": ["string"],
      "changes": ["string"]
    }
  `;

  const text = await generateWithRetry(modelChain, prompt);
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

  let raw;
  try {
    raw = JSON.parse(cleaned);
  } catch (err) {
    logger.error('Failed to parse JSON from tailored resume response', {
      rawResponsePreview: cleaned.slice(0, 2000),
      rawResponseLength: cleaned.length,
    });
    throw new Error('Could not parse the AI response for the tailored resume into valid JSON.');
  }

  const document = normalizeTailored(raw, resume);
  if (document.work_experience.length === 0 && asArray(resume.work_experience).length > 0) {
    throw new Error('The AI returned a tailored resume with no work experience. Please try again.');
  }

  return {
    document,
    comparison: {
      before: summariseAts(analyzeAts(resume, { jobDescription })),
      after: summariseAts(scoreTailored(document, jobDescription)),
    },
  };
};

module.exports = { tailorResume, normalizeTailored, tailoredToText };

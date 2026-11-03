// backend/services/atsService.js
//
// A deterministic, rule-based ATS (Applicant Tracking System) readiness check.
// It makes NO LLM calls: everything here is computed from the stored resume
// text and the structured fields extracted on upload, so it is instant, free,
// and unit-testable. (jdMatchService is the LLM-based, JD-specific counterpart.)
//
// Optionally, a job description can be passed in; keyword coverage is then
// measured against SKILL_TAXONOMY terms found in that JD - again with plain
// string matching, no model involved.
const { SKILL_TAXONOMY } = require('../data/skillTaxonomy');

const ACTION_VERBS = new Set([
  'achieved', 'architected', 'automated', 'built', 'championed', 'collaborated', 'configured',
  'contributed', 'created', 'cut', 'debugged', 'decreased', 'delivered', 'deployed', 'designed',
  'developed', 'devised', 'directed', 'drove', 'eliminated', 'enabled', 'engineered', 'enhanced',
  'established', 'executed', 'expanded', 'facilitated', 'implemented', 'improved', 'increased',
  'initiated', 'integrated', 'introduced', 'launched', 'led', 'maintained', 'managed', 'migrated',
  'mentored', 'modernized', 'optimized', 'orchestrated', 'owned', 'partnered', 'pioneered',
  'planned', 'reduced', 'refactored', 'released', 'replaced', 'resolved', 'restructured',
  'scaled', 'secured', 'shipped', 'simplified', 'spearheaded', 'standardized', 'streamlined',
  'strengthened', 'supported', 'tested', 'trained', 'transformed', 'tuned', 'upgraded', 'wrote',
]);

const WEAK_PHRASES = [
  'responsible for', 'worked on', 'helped with', 'helped to', 'duties included',
  'tasked with', 'assisted with', 'in charge of', 'involved in',
];

// Headings an ATS parser reliably recognises. Matched against whole lines.
const SECTION_PATTERNS = {
  experience: /^(work\s+)?(professional\s+)?(experience|employment(\s+history)?|work\s+history)\s*:?$/i,
  education: /^(education(al)?(\s+background)?|academic\s+background|qualifications)\s*:?$/i,
  skills: /^((technical|core|key)\s+)?skills(\s*(&|and)\s*\w+)?\s*:?$/i,
  projects: /^(personal\s+|academic\s+|key\s+)?projects\s*:?$/i,
  summary: /^(professional\s+)?(summary|profile|objective|about(\s+me)?)\s*:?$/i,
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsTerm = (haystackLower, term) => {
  const t = term.toLowerCase();
  // Terms with symbols (C++, C#, .NET, Node.js) can't use \b on both sides.
  const pattern = new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(t)}(?![a-z0-9+#])`, 'i');
  return pattern.test(haystackLower);
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const collectBullets = (workExperience) =>
  toArray(workExperience)
    .flatMap((job) => toArray(job && job.description))
    .filter((b) => typeof b === 'string' && b.trim().length > 0);

const statusFor = (ratio, passAt, warnAt) => (ratio >= passAt ? 'pass' : ratio >= warnAt ? 'warn' : 'fail');
const POINTS_BY_STATUS = { pass: 1, warn: 0.5, fail: 0 };

/**
 * @param {object} resume - a row from the `resumes` table (or anything with the same fields)
 * @param {{ jobDescription?: string }} [options]
 * @returns {{ score: number, grade: string, checks: object[], keywordCoverage: object|null, stats: object }}
 */
const analyzeAts = (resume, options = {}) => {
  const text = String(resume.resume_text || '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const wordCount = (text.match(/\S+/g) || []).length;
  const checks = [];
  const add = (id, label, weight, status, detail) => checks.push({ id, label, weight, status, detail });

  // --- Contact information -------------------------------------------------
  const hasEmail = Boolean(resume.email) || /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text);
  const hasPhone = Boolean(resume.phone) || /(\+?\d[\d\s().-]{8,}\d)/.test(text);
  const hasLinkedIn = Boolean(resume.linkedin_url) || /linkedin\.com\//i.test(text);
  const contactFound = [hasEmail, hasPhone, hasLinkedIn].filter(Boolean).length;
  add(
    'contact', 'Contact information', 10,
    hasEmail && hasPhone ? 'pass' : hasEmail || hasPhone ? 'warn' : 'fail',
    `Found: ${[hasEmail && 'email', hasPhone && 'phone', hasLinkedIn && 'LinkedIn'].filter(Boolean).join(', ') || 'none'}.` +
      (contactFound < 3 && !hasLinkedIn && hasEmail && hasPhone ? ' Adding a LinkedIn URL is a common recruiter expectation.' : '')
  );

  // --- Standard section headings ------------------------------------------
  const foundSections = Object.keys(SECTION_PATTERNS).filter((key) => lines.some((l) => SECTION_PATTERNS[key].test(l)));
  const requiredSections = ['experience', 'education', 'skills'];
  const requiredFound = requiredSections.filter((s) => foundSections.includes(s));
  add(
    'sections', 'Standard section headings', 20,
    statusFor(requiredFound.length / requiredSections.length, 1, 0.66),
    requiredFound.length === requiredSections.length
      ? `Found the core sections (${foundSections.join(', ')}).`
      : `Missing recognisable heading(s): ${requiredSections.filter((s) => !requiredFound.includes(s)).join(', ')}. ATS parsers look for plain headings like "Experience", "Education" and "Skills".`
  );

  // --- Length ---------------------------------------------------------------
  const lengthStatus = wordCount >= 250 && wordCount <= 900 ? 'pass' : wordCount >= 150 && wordCount <= 1200 ? 'warn' : 'fail';
  add(
    'length', 'Resume length', 10, lengthStatus,
    `${wordCount} words. ${wordCount < 250 ? 'That is short - add detail on impact and scope.' : wordCount > 900 ? 'That is long - aim for one to two pages.' : 'A healthy length for one to two pages.'}`
  );

  // --- Bullet quality -------------------------------------------------------
  const bullets = collectBullets(resume.work_experience);
  if (bullets.length === 0) {
    add('bullets', 'Experience bullet points', 15, 'fail', 'No bullet points were found under work experience.');
    add('action_verbs', 'Strong action verbs', 10, 'fail', 'No bullets to evaluate.');
    add('quantified', 'Quantified achievements', 15, 'fail', 'No bullets to evaluate.');
    add('weak_phrases', 'Weak or passive phrasing', 5, 'warn', 'No bullets to evaluate.');
  } else {
    add(
      'bullets', 'Experience bullet points', 15,
      bullets.length >= 6 ? 'pass' : bullets.length >= 3 ? 'warn' : 'fail',
      `${bullets.length} bullet point${bullets.length === 1 ? '' : 's'} across ${toArray(resume.work_experience).length} role(s).`
    );

    const withVerb = bullets.filter((b) => {
      const first = b.replace(/^[^A-Za-z]+/, '').split(/\s+/)[0] || '';
      return ACTION_VERBS.has(first.toLowerCase());
    });
    const verbRatio = withVerb.length / bullets.length;
    add(
      'action_verbs', 'Strong action verbs', 10, statusFor(verbRatio, 0.7, 0.4),
      `${withVerb.length} of ${bullets.length} bullets start with a strong action verb (${Math.round(verbRatio * 100)}%).`
    );

    const quantified = bullets.filter((b) => /\d/.test(b));
    const quantRatio = quantified.length / bullets.length;
    add(
      'quantified', 'Quantified achievements', 15, statusFor(quantRatio, 0.4, 0.2),
      `${quantified.length} of ${bullets.length} bullets include a number, percentage or scale (${Math.round(quantRatio * 100)}%). Metrics make impact credible.`
    );

    const weak = bullets.filter((b) => WEAK_PHRASES.some((p) => b.toLowerCase().includes(p)));
    add(
      'weak_phrases', 'Weak or passive phrasing', 5,
      weak.length === 0 ? 'pass' : weak.length <= 2 ? 'warn' : 'fail',
      weak.length === 0
        ? 'No passive phrases like "responsible for" or "worked on".'
        : `${weak.length} bullet(s) use passive phrasing such as "responsible for" or "worked on".`
    );
  }

  // --- Skills ---------------------------------------------------------------
  const skillCount = toArray(resume.technical_skills).length;
  add(
    'skills_list', 'Skills listed', 10,
    skillCount >= 8 ? 'pass' : skillCount >= 4 ? 'warn' : 'fail',
    `${skillCount} technical skill${skillCount === 1 ? '' : 's'} detected. ATS keyword filters key off this list.`
  );

  // --- Parse-safety: layout artefacts --------------------------------------
  const pipeLines = lines.filter((l) => (l.match(/\|/g) || []).length >= 2).length;
  const oddGlyphs = (text.match(/[^\x00-\x7F‘’“”–—•·…]/g) || []).length;
  const glyphRatio = text.length ? oddGlyphs / text.length : 0;
  const layoutRisky = pipeLines > 3 || glyphRatio > 0.02;
  add(
    'parse_safety', 'Parse-friendly layout', 5,
    layoutRisky ? 'warn' : 'pass',
    layoutRisky
      ? 'The text contains table-like separators or many unusual symbols (icons, multi-column layouts). Some ATS parsers scramble these.'
      : 'No table-like separators or unusual symbols detected in the extracted text.'
  );

  // --- Score ----------------------------------------------------------------
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => sum + c.weight * POINTS_BY_STATUS[c.status], 0);
  const score = Math.round((earned / totalWeight) * 100);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  // --- Optional JD keyword coverage (string matching only) -----------------
  let keywordCoverage = null;
  const jd = typeof options.jobDescription === 'string' ? options.jobDescription.trim() : '';
  if (jd) {
    const jdLower = jd.toLowerCase();
    const resumeLower = [text, ...toArray(resume.technical_skills), ...toArray(resume.soft_skills)].join('\n').toLowerCase();
    const requested = [...new Set(SKILL_TAXONOMY.filter((skill) => containsTerm(jdLower, skill)))];
    const matched = requested.filter((skill) => containsTerm(resumeLower, skill));
    const missing = requested.filter((skill) => !matched.includes(skill));
    keywordCoverage = {
      requested: requested.length,
      matched,
      missing,
      percent: requested.length ? Math.round((matched.length / requested.length) * 100) : null,
    };
  }

  return {
    score,
    grade,
    checks: checks.map(({ id, label, status, detail }) => ({ id, label, status, detail })),
    keywordCoverage,
    stats: { wordCount, bulletCount: bullets.length, sectionsFound: foundSections },
  };
};

module.exports = { analyzeAts };

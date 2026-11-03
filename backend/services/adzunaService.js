// backend/services/adzunaService.js
require('dotenv').config();
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { SKILL_TAXONOMY } = require('../data/skillTaxonomy');
const {
  calculateTotalExperienceYears,
  extractJobExperienceRequirement,
  scoreExperienceFit,
  EXPERIENCE_TIER_ORDER,
} = require('../utils/experience');

const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

/**
 * Escapes a string for safe use inside a RegExp constructor.
 * @param {string} value
 * @returns {string}
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Adzuna's own "employment type" flags. Only one is ever sent per search -
// the UI offers a single-select dropdown, not independent checkboxes -
// since "full_time AND contract" isn't a meaningful combination to ask for.
const EMPLOYMENT_TYPE_PARAM = {
  full_time: 'full_time',
  part_time: 'part_time',
  contract: 'contract',
  permanent: 'permanent',
};

/**
 * Calls the Adzuna Jobs Search API and normalizes the response into a
 * flat list of plain job objects. Adzuna's free tier only requires an
 * app_id/app_key pair (no OAuth), so this is a simple authenticated GET.
 *
 * maxDaysOld/salaryMin/salaryMax/employmentType are passed straight through
 * as Adzuna's own server-side filters (max_days_old, salary_min, salary_max,
 * full_time=1/part_time=1/contract=1/permanent=1) rather than being
 * re-implemented locally - this narrows what Adzuna returns in the first
 * place, instead of us fetching everything and throwing rows away after.
 * @param {{ what: string, where?: string, page?: number, maxDaysOld?: number, salaryMin?: number, salaryMax?: number, employmentType?: 'full_time'|'part_time'|'contract'|'permanent' }} params
 * @returns {Promise<Array<object>>}
 */
const searchJobs = async ({ what, where, page = 1, maxDaysOld, salaryMin, salaryMax, employmentType }) => {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = process.env.ADZUNA_COUNTRY || 'in';

  if (!appId || !appKey) {
    throw new ApiError(503, 'Job search is not configured on the server yet. Please try again later.');
  }

  const url = new URL(`${ADZUNA_BASE_URL}/${country}/search/${page}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('results_per_page', '20');
  url.searchParams.set('what', what);
  url.searchParams.set('content-type', 'application/json');
  if (where) {
    url.searchParams.set('where', where);
  }
  if (Number.isFinite(maxDaysOld) && maxDaysOld > 0) {
    url.searchParams.set('max_days_old', String(Math.trunc(maxDaysOld)));
  }
  if (Number.isFinite(salaryMin) && salaryMin > 0) {
    url.searchParams.set('salary_min', String(Math.trunc(salaryMin)));
  }
  if (Number.isFinite(salaryMax) && salaryMax > 0) {
    url.searchParams.set('salary_max', String(Math.trunc(salaryMax)));
  }
  const employmentTypeParam = EMPLOYMENT_TYPE_PARAM[employmentType];
  if (employmentTypeParam) {
    url.searchParams.set(employmentTypeParam, '1');
  }

  let response;
  try {
    response = await fetch(url.toString());
  } catch (networkErr) {
    logger.error('Adzuna request failed (network error)', { message: networkErr.message });
    throw new ApiError(503, 'Could not reach the job search provider. Please try again shortly.');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      logger.error('Adzuna rejected our credentials', { status: response.status });
      throw new ApiError(503, 'Job search credentials are invalid or missing. Please try again later.');
    }
    logger.error('Adzuna returned a non-OK status', { status: response.status });
    throw new ApiError(502, 'The job search provider returned an unexpected error.');
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    logger.error('Failed to parse Adzuna response as JSON', { message: parseErr.message });
    throw new ApiError(502, 'The job search provider returned an unreadable response.');
  }

  const results = Array.isArray(data.results) ? data.results : [];

  return results.map((job) => ({
    id: String(job.id ?? `${job.title}-${job.created}`),
    title: job.title || 'Untitled role',
    company: job.company?.display_name || 'Unknown company',
    location: job.location?.display_name || (where || 'Not specified'),
    description: job.description || '',
    url: job.redirect_url || null,
    salaryMin: typeof job.salary_min === 'number' ? Math.round(job.salary_min) : null,
    salaryMax: typeof job.salary_max === 'number' ? Math.round(job.salary_max) : null,
    postedAt: job.created || null,
    category: job.category?.label || null,
    contractTime: job.contract_time || null,
    contractType: job.contract_type || null,
  }));
};

/**
 * Strips everything except letters/digits down to single spaces, lowercases,
 * and collapses whitespace - e.g. "React.js" / "React-JS" / "react   js"
 * all become "react js".
 * @param {string} value
 * @returns {string}
 */
const stripAndCollapse = (value) => String(value)
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, ' ');

/**
 * Breaks apart fused camelCase compounds, e.g. "ReactJS" -> "React JS",
 * "NodeJS" -> "Node JS". Left alone, "ReactJS" would stay one unbroken word
 * after stripAndCollapse and never line up with "React.js" or "React JS".
 * @param {string} value
 * @returns {string}
 */
const splitCamelCase = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2');

/**
 * Produces the 1-2 normalized forms worth trying for a SKILL term: the plain
 * punctuation-stripped form, and (only if it differs) the same after first
 * splitting camelCase boundaries. This is deliberately only ever applied to
 * the (short, curated) skill side, never to the job's free-form prose - see
 * skillMatchesText for why splitting natural prose is unsafe (it would turn
 * "JavaScript" into a standalone "Java" token and cause false matches).
 * Producing both forms here means a resume skill written as "ReactJS",
 * "React.js", or "React JS" will still line up with whichever of those
 * spellings the job text happens to use.
 * @param {string} value
 * @returns {string[]}
 */
const normalizeForms = (value) => {
  const noSplit = stripAndCollapse(value);
  const withSplit = stripAndCollapse(splitCamelCase(value));
  return withSplit === noSplit ? [noSplit] : [noSplit, withSplit];
};

// A few well-known tech terms carry meaning in their punctuation that
// stripAndCollapse would otherwise strip entirely (e.g. "C++" -> "c",
// "C#" -> "c" - both indistinguishable from the letter "C"). These are
// matched as plain, case-insensitive substrings against the raw job text
// instead of going through normalization.
const SYMBOL_SKILL_ALIASES = {
  'c++': ['c++', 'cpp'],
  'c#': ['c#', 'c-sharp', 'csharp'],
  'f#': ['f#', 'f-sharp', 'fsharp'],
  '.net': ['.net', 'dot net', 'dotnet'],
  'objective-c': ['objective-c', 'objective c', 'objc'],
};

/**
 * Checks whether a single skill term appears in a piece of text, either via
 * the curated symbol-alias list (for terms like "C++"/"C#"/".NET") or via
 * normalized, whole-word matching against that text.
 *
 * The target text (haystackText) is intentionally run through
 * stripAndCollapse ONLY - never splitCamelCase. Splitting natural prose is
 * unsafe: it would turn a plain mention of "JavaScript" into "Java Script",
 * which then makes "Java" look like its own standalone word and falsely
 * match. Splitting is only safe on the skill side, which is a short,
 * curated term rather than free-form prose.
 * @param {string} skill
 * @param {string} rawTextLower - the target text, lowercased, unmodified
 * @param {string} haystackText - stripAndCollapse(targetText), NOT split
 * @returns {boolean}
 */
const skillMatchesText = (skill, rawTextLower, haystackText) => {
  const rawSkillLower = skill.toLowerCase().trim();
  const aliases = SYMBOL_SKILL_ALIASES[rawSkillLower];
  if (aliases) {
    return aliases.some((alias) => rawTextLower.includes(alias));
  }
  if (rawSkillLower === 'c') {
    // Plain "C" is a prefix of "C++"/"C#" - after stripAndCollapse strips
    // their symbols down to a bare "c", the generic path below would still
    // (technically correctly, per its own boundary rules) match it, which
    // is wrong: a job asking for C++ isn't asking for plain C. This checks
    // the RAW text directly and requires "C" not be immediately followed
    // by one of those languages' own punctuation.
    return /(?:^|[^a-z0-9])c(?![a-z0-9+#])/i.test(rawTextLower);
  }
  const skillForms = normalizeForms(skill).filter(Boolean);
  return skillForms.some((skillForm) => new RegExp(`\\b${escapeRegExp(skillForm)}\\b`).test(haystackText));
};

/**
 * Parses a resume row's technical_skills column (stored as JSON, but may
 * already have been parsed by the driver) into a flat string array.
 * @param {string|string[]|undefined} value
 * @returns {string[]}
 */
const parseSkillsField = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

/**
 * Parses a resume row's work_experience column (stored as JSON, but may
 * already have been parsed by the driver) into a flat array of entries.
 * Mirrors parseSkillsField's leniency: anything unparseable/absent yields
 * an empty array rather than throwing, so a bad column never breaks
 * job search - it just means 0 years get counted.
 * @param {string|object[]|undefined} value
 * @returns {object[]}
 */
const parseWorkExperienceField = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

/**
 * De-duplicates a list of skill strings, keeping the first-seen spelling
 * for each. Most skills are deduped case/punctuation-insensitively (via
 * stripAndCollapse), so "React.js" from a resume and "React.js" from the
 * taxonomy collapse to one entry. Symbol-sensitive terms (C++/C#/F#/.NET/
 * Objective-C) are deliberately NOT run through stripAndCollapse for this -
 * that would strip their distinguishing punctuation and collapse "C++",
 * "C#", and plain "C" into the same key, silently dropping two of the
 * three from the candidate list entirely.
 * @param {string[]} skills
 * @returns {string[]}
 */
const dedupeSkills = (skills) => {
  const seen = new Map();
  for (const raw of skills) {
    const skill = String(raw || '').trim();
    if (!skill) continue;
    const rawLower = skill.toLowerCase();
    const key = SYMBOL_SKILL_ALIASES[rawLower] ? rawLower : stripAndCollapse(skill);
    if (key && !seen.has(key)) seen.set(key, skill);
  }
  return [...seen.values()];
};

/**
 * Scores a job against a resume by first figuring out what the JOB itself
 * is asking for, then checking how much of that the resume actually has -
 * i.e. score = |skills the job wants AND the resume has| / |skills the job
 * wants|. This is the flip of a simpler "how much of the resume's skill
 * list does this job mention" approach: that version reads as misleadingly
 * low for any resume with a long skill list, since most of those skills are
 * irrelevant to any single posting. Scoring against the job's own
 * requirements is what actually answers "how well do I fit THIS job".
 *
 * A job posting's text has no structured "required skills" field (Adzuna
 * only gives free-form title/description), so this is approximated by
 * scanning the job text for every skill in a broad, curated taxonomy
 * (SKILL_TAXONOMY) PLUS the resume's own listed skills (so something
 * specific to this candidate that the generic taxonomy doesn't happen to
 * include still counts, in either direction). Whatever subset of that
 * combined list actually appears in the job's text becomes "what this job
 * wants"; whichever of those also appear in the resume's own text becomes
 * "what you have for it".
 *
 * This is deliberately a local/offline heuristic (not an AI call) so that
 * browsing job results never consumes the app's tight Gemini rate-limit
 * budget - it only costs one Adzuna request per search.
 * @param {{title: string, description: string}} job
 * @param {{ resume_text?: string, technical_skills?: string|string[] }} resume
 * @returns {{ score: number, matchedSkills: string[], missingSkills: string[] }}
 */
const scoreJobAgainstResume = (job, resume) => {
  const jobText = `${job.title} ${job.description}`;
  const jobTextLower = jobText.toLowerCase();
  const jobHaystack = stripAndCollapse(jobText);

  const resumeSkills = parseSkillsField(resume.technical_skills);
  const resumeText = resume.resume_text || '';
  const resumeTextLower = resumeText.toLowerCase();
  // Matching against resume_text (not just the extracted skills list) means
  // a skill mentioned in an experience bullet or project, but not pulled
  // into technical_skills by the AI extraction, still counts.
  const resumeHaystack = stripAndCollapse(`${resumeText} ${resumeSkills.join(' ')}`);

  const candidateSkills = dedupeSkills([...resumeSkills, ...SKILL_TAXONOMY]);
  const jobSkills = candidateSkills.filter((skill) => skillMatchesText(skill, jobTextLower, jobHaystack));

  const matchedSkills = jobSkills.filter((skill) => skillMatchesText(skill, resumeTextLower, resumeHaystack));
  const matchedSet = new Set(matchedSkills);
  const missingSkills = jobSkills.filter((skill) => !matchedSet.has(skill));

  const score = jobSkills.length ? Math.min(100, Math.round((matchedSkills.length / jobSkills.length) * 100)) : 0;

  return { score, matchedSkills, missingSkills };
};

/**
 * Finds and ranks jobs for a given stored resume. Uses the resume's job
 * title / top skills as the search query when the caller doesn't supply
 * one explicitly, then ranks every result locally.
 *
 * Ranking is two-tiered: a candidate's years of experience vs. what a
 * posting seems to ask for is the PRIMARY criterion (see experience.js -
 * scoreExperienceFit / EXPERIENCE_TIER_ORDER), with the skill-overlap score
 * (scoreJobAgainstResume) as the secondary criterion / tiebreaker within a
 * tier. This mirrors how a person actually filters job search results:
 * "am I even in the right experience bracket for this?" comes before "how
 * many of the skills match". Postings with no detectable experience
 * requirement fall into the neutral "unknown" tier rather than being
 * penalized or boosted - most postings don't state a number, and that
 * shouldn't count against them.
 *
 * `resume` may be null/undefined - e.g. someone searching for openings on
 * behalf of a friend, or just browsing without picking one of their own
 * resumes first. Without a resume there is nothing to score skill-overlap
 * or experience-fit against, so every job gets neutral placeholders
 * (score 0, no matched/missing skills, experienceFit "unknown") instead of
 * a fabricated ranking. The next most useful ordering at that point is
 * newest-posting-first, since there's no personalized signal to sort by.
 * @param {object|null|undefined} resume - a row from the `resumes` table, or null for an unranked search
 * @param {{ what?: string, where?: string, maxDaysOld?: number, salaryMin?: number, salaryMax?: number, employmentType?: 'full_time'|'part_time'|'contract'|'permanent' }} [overrides]
 * @returns {Promise<{ jobs: Array<object>, candidateExperienceYears: number|null }>}
 */
const findJobsForResume = async (resume, overrides = {}) => {
  const skills = resume ? parseSkillsField(resume.technical_skills) : [];

  const what = overrides.what || skills.slice(0, 3).join(' ') || 'software engineer';
  const where = overrides.where || undefined;

  const jobs = await searchJobs({
    what,
    where,
    maxDaysOld: overrides.maxDaysOld,
    salaryMin: overrides.salaryMin,
    salaryMax: overrides.salaryMax,
    employmentType: overrides.employmentType,
  });

  if (!resume) {
    const unranked = jobs
      .map((job) => ({
        ...job,
        score: 0,
        matchedSkills: [],
        missingSkills: [],
        experienceRequirement: extractJobExperienceRequirement(`${job.title} ${job.description}`),
        experienceFit: { tier: 'unknown' },
      }))
      .sort((a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime());
    return { jobs: unranked, candidateExperienceYears: null };
  }

  const candidateExperienceYears = calculateTotalExperienceYears(
    parseWorkExperienceField(resume.work_experience),
  );

  const ranked = jobs
    .map((job) => {
      const experienceRequirement = extractJobExperienceRequirement(`${job.title} ${job.description}`);
      const experienceFit = scoreExperienceFit(candidateExperienceYears, experienceRequirement);
      return {
        ...job,
        ...scoreJobAgainstResume(job, resume),
        experienceRequirement,
        experienceFit,
      };
    })
    .sort((a, b) => {
      const tierDiff = EXPERIENCE_TIER_ORDER[a.experienceFit.tier] - EXPERIENCE_TIER_ORDER[b.experienceFit.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.score - a.score;
    });

  return { jobs: ranked, candidateExperienceYears };
};

module.exports = {
  findJobsForResume,
  searchJobs,
  scoreJobAgainstResume,
  escapeRegExp,
  parseWorkExperienceField,
};

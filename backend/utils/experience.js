// backend/utils/experience.js
//
// Turns the free-text `duration` strings inside a resume's work_experience
// array into a total years-of-experience number, and turns a job posting's
// free-text title+description into a requested experience range - so job
// matching can rank by "does this candidate's experience level fit this
// role" as its primary criterion, with skill overlap as the tiebreaker.
//
// Both directions are inherently approximate: resumes describe durations in
// wildly inconsistent ways, and most job postings don't state a number of
// years at all. Every parser here fails toward "unknown" (0, or null)
// rather than guessing, so a bad parse quietly drops out of the ranking
// signal instead of silently corrupting it.

const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

const ONGOING_WORDS = /\b(present|current|currently|now|ongoing|till date|to date)\b/i;

/**
 * Converts a single date-like fragment ("Jan 2022", "January 2022",
 * "2022", "01/2022", "2022-01") into a decimal year (e.g. 2022.08 for
 * February 2022), or null if it doesn't look like a date at all.
 * @param {string} fragment
 * @returns {number|null}
 */
const parseDateFragment = (fragment) => {
  const text = fragment.trim();
  if (!text) return null;

  // "Month YYYY" / "Mon YYYY" (also handles "Mon. YYYY", "Mon-YYYY")
  const monthYear = text.match(/([A-Za-z]{3,})\.?\s*[,-]?\s*(\d{4})/);
  if (monthYear) {
    const monthIndex = MONTH_NAMES.indexOf(monthYear[1].slice(0, 3).toLowerCase());
    const year = Number(monthYear[2]);
    if (monthIndex >= 0 && year > 1900 && year < 2100) {
      return year + monthIndex / 12;
    }
  }

  // "MM/YYYY" or "MM-YYYY"
  const numericMonthYear = text.match(/^(\d{1,2})[/-](\d{4})$/);
  if (numericMonthYear) {
    const month = Number(numericMonthYear[1]);
    const year = Number(numericMonthYear[2]);
    if (month >= 1 && month <= 12 && year > 1900 && year < 2100) {
      return year + (month - 1) / 12;
    }
  }

  // "YYYY-MM"
  const isoYearMonth = text.match(/^(\d{4})-(\d{1,2})$/);
  if (isoYearMonth) {
    const year = Number(isoYearMonth[1]);
    const month = Number(isoYearMonth[2]);
    if (month >= 1 && month <= 12 && year > 1900 && year < 2100) {
      return year + (month - 1) / 12;
    }
  }

  // A bare 4-digit year - treated as the start of that year (a rough
  // approximation; the alternative of "middle of the year" would average
  // out better across many entries, but errs toward under- rather than
  // over-counting experience, which is the safer direction for this
  // feature's purpose).
  const bareYear = text.match(/^(\d{4})$/);
  if (bareYear) {
    const year = Number(bareYear[1]);
    if (year > 1900 && year < 2100) return year;
  }

  return null;
};

/**
 * Returns the current moment as a decimal year, for resolving "Present" /
 * "Current" / etc. endpoints.
 * @returns {number}
 */
const nowAsDecimalYear = () => {
  const now = new Date();
  return now.getUTCFullYear() + now.getUTCMonth() / 12;
};

/**
 * Splits a duration string into [startRaw, endRaw] around whatever
 * separates its two dates. Tries, in priority order: a hyphen/en-dash
 * with whitespace on both sides (unambiguous even when a side is itself a
 * "YYYY-MM" token); the words "to"/"until"; and only as a last resort, a
 * bare hyphen with no surrounding whitespace - trying every such hyphen's
 * position (not just the first) and keeping the first one where both
 * sides actually parse as dates. That last fallback is what makes
 * "2019-2021" split correctly while NOT mis-splitting "2018-01 - 2020-06"
 * on the hyphen inside "2018-01" (the first fallback rule already handles
 * that one before this is ever reached).
 * @param {string} text
 * @returns {[string, string]|null}
 */
const splitDurationRange = (text) => {
  const spaced = text.match(/^(.*?)\s+[-–—]\s+(.*)$/);
  if (spaced && spaced[1].trim() && spaced[2].trim()) return [spaced[1], spaced[2]];

  const wordSep = text.match(/^(.*?)\s*\b(?:to|until)\b\s*(.*)$/i);
  if (wordSep && wordSep[1].trim() && wordSep[2].trim()) return [wordSep[1], wordSep[2]];

  let searchFrom = 0;
  for (;;) {
    const idx = text.indexOf('-', searchFrom);
    if (idx === -1) return null;
    const left = text.slice(0, idx);
    const right = text.slice(idx + 1);
    if (left.trim() && right.trim()) {
      const leftOk = parseDateFragment(left) != null;
      const rightOk = ONGOING_WORDS.test(right) || parseDateFragment(right) != null;
      if (leftOk && rightOk) return [left, right];
    }
    searchFrom = idx + 1;
  }
};

/**
 * Parses one work_experience entry's `duration` string into a number of
 * years. Tries, in order: a two-sided date range (with either side
 * possibly "Present"), a "Since <date>" phrase, then a plain "X years Y
 * months"-style phrase. Returns 0 (not null) for anything unparseable, so
 * it can be summed directly without extra null-checking at every call
 * site.
 * @param {string} duration
 * @returns {number}
 */
const parseDurationToYears = (duration) => {
  if (!duration || typeof duration !== 'string') return 0;
  const normalized = duration
    .replace(/[‒–—―]/g, '-') // various dash characters -> hyphen
    .trim();

  const split = splitDurationRange(normalized);
  if (split) {
    const [startRaw, endRaw] = split;
    const start = parseDateFragment(startRaw);
    const end = ONGOING_WORDS.test(endRaw) ? nowAsDecimalYear() : parseDateFragment(endRaw);
    if (start != null && end != null) {
      const years = end - start;
      return years > 0 ? years : 0;
    }
  }

  // "Since 2021" / "Since Jan 2021" - a start date with no separator at
  // all, implicitly ongoing.
  const sinceMatch = normalized.match(/^since\s+(.+)$/i);
  if (sinceMatch) {
    const start = parseDateFragment(sinceMatch[1]);
    if (start != null) {
      const years = nowAsDecimalYear() - start;
      return years > 0 ? years : 0;
    }
  }

  // A single date plus an ongoing marker elsewhere in the string that
  // didn't split cleanly above, e.g. "2021, ongoing".
  if (ONGOING_WORDS.test(normalized)) {
    const solo = parseDateFragment(normalized.replace(ONGOING_WORDS, '').trim());
    if (solo != null) {
      const years = nowAsDecimalYear() - solo;
      return years > 0 ? years : 0;
    }
  }

  // A plain duration phrase: "2 years", "1.5 yrs", "6 months", or a
  // combination like "1 year 6 months".
  let total = 0;
  let matchedSomething = false;
  const yearsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i);
  if (yearsMatch) {
    total += Number(yearsMatch[1]);
    matchedSomething = true;
  }
  const monthsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?)\b/i);
  if (monthsMatch) {
    total += Number(monthsMatch[1]) / 12;
    matchedSomething = true;
  }
  if (matchedSomething) return total;

  return 0;
};

// A single work stint longer than this is almost certainly a parsing
// error (e.g. two unrelated 4-digit numbers picked up as a range) rather
// than a real job, so it's excluded from the total instead of skewing it.
const MAX_PLAUSIBLE_SINGLE_STINT_YEARS = 40;

/**
 * Sums parseDurationToYears across every work_experience entry to
 * estimate total professional experience. This is a simple sum, not an
 * overlap-aware union of date ranges - concurrent roles (e.g. a part-time
 * job alongside a full-time one) would double-count. That's an accepted
 * simplification given resumes rarely make overlap explicit anyway.
 * @param {Array<{ duration?: string }>} workExperience
 * @returns {number} total years, rounded to one decimal place
 */
const calculateTotalExperienceYears = (workExperience) => {
  if (!Array.isArray(workExperience)) return 0;
  const total = workExperience
    .map((entry) => parseDurationToYears(entry && entry.duration))
    .filter((years) => years >= 0 && years <= MAX_PLAUSIBLE_SINGLE_STINT_YEARS)
    .reduce((sum, years) => sum + years, 0);
  return Math.round(total * 10) / 10;
};

// Soft, title-only fallback levels, used only when no explicit number of
// years is found anywhere in the job text. Deliberately approximate -
// flagged as such wherever it's surfaced.
const LEVEL_WORD_RANGES = [
  { pattern: /\b(intern|internship|fresher|entry[\s-]?level|no experience required|graduate trainee)\b/i, min: 0, max: 1 },
  { pattern: /\b(junior)\b/i, min: 0, max: 2 },
  { pattern: /\b(mid[\s-]?level|intermediate)\b/i, min: 2, max: 5 },
  { pattern: /\b(senior|sr\.?\b|lead|principal|staff)\b/i, min: 5, max: null },
];

/**
 * Scans a job posting's text for an explicit years-of-experience
 * requirement ("5+ years", "2-4 years of experience", "minimum 3 years",
 * "at least 2 years"), falling back to a soft title-level heuristic
 * (junior/senior/etc.) only if no explicit number is found.
 * @param {string} jobText
 * @returns {{ min: number|null, max: number|null, approximate: boolean }|null}
 *   null if nothing about experience level could be detected at all.
 */
const extractJobExperienceRequirement = (jobText) => {
  const text = String(jobText || '');

  const rangeMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)\+?\s*years?/i);
  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]), approximate: false };
  }

  const plusMatch = text.match(/(\d+)\s*\+\s*years?/i) || text.match(/(?:minimum|min\.?|at least)\s*(?:of\s*)?(\d+)\s*years?/i);
  if (plusMatch) {
    return { min: Number(plusMatch[1]), max: null, approximate: false };
  }

  const exactMatch = text.match(/(\d+)\s*years?\s*(?:of\s*)?experience/i);
  if (exactMatch) {
    const years = Number(exactMatch[1]);
    return { min: years, max: years, approximate: false };
  }

  for (const level of LEVEL_WORD_RANGES) {
    if (level.pattern.test(text)) {
      return { min: level.min, max: level.max, approximate: true };
    }
  }

  return null;
};

/**
 * Compares a candidate's total years of experience against a job's
 * requirement (from extractJobExperienceRequirement) and returns a coarse
 * fit tier used to rank job matches. Underqualification is treated as a
 * hard mismatch (a stated minimum is usually a real screening bar);
 * overqualification is treated as a much softer signal (many candidates
 * successfully apply above a role's nominal level), and "unknown" (no
 * detectable requirement) is neutral - neither held for nor against.
 * @param {number} candidateYears
 * @param {{min: number|null, max: number|null}|null} requirement
 * @returns {{ tier: 'good'|'unknown'|'overqualified'|'underqualified' }}
 */
const EXPERIENCE_FIT_TOLERANCE_YEARS = 0.5;
const OVERQUALIFIED_MARGIN_YEARS = 4;

const scoreExperienceFit = (candidateYears, requirement) => {
  if (!requirement) return { tier: 'unknown' };
  const { min, max } = requirement;
  if (min != null && candidateYears + EXPERIENCE_FIT_TOLERANCE_YEARS < min) {
    return { tier: 'underqualified' };
  }
  if (max != null && candidateYears > max + OVERQUALIFIED_MARGIN_YEARS) {
    return { tier: 'overqualified' };
  }
  return { tier: 'good' };
};

// Sort priority for scoreExperienceFit's tiers - lower sorts first. "good"
// and "unknown" both rank ahead of any detected mismatch, since an
// undetected requirement should never be penalized.
const EXPERIENCE_TIER_ORDER = { good: 0, unknown: 1, overqualified: 2, underqualified: 3 };

module.exports = {
  parseDurationToYears,
  calculateTotalExperienceYears,
  extractJobExperienceRequirement,
  scoreExperienceFit,
  EXPERIENCE_TIER_ORDER,
};

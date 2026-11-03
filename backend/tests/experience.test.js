// backend/tests/experience.test.js
const {
  parseDurationToYears,
  calculateTotalExperienceYears,
  extractJobExperienceRequirement,
  scoreExperienceFit,
  EXPERIENCE_TIER_ORDER,
} = require('../utils/experience');

describe('parseDurationToYears', () => {
  const nowYear = new Date().getUTCFullYear();

  it.each([
    ['Jan 2018 - Jun 2020', 2.42],
    ['January 2018 - June 2020', 2.42],
    ['2018-01 - 2020-06', 2.42],
    ['2018-01-2020-06', 2.42],
    ['01/2018 - 06/2020', 2.42],
    ['2018 - 2020', 2],
    ['Jan 2020 - Present', nowYear + new Date().getUTCMonth() / 12 - 2020],
    ['Mar 2019 to Current', nowYear + new Date().getUTCMonth() / 12 - (2019 + 2 / 12)],
    ['Since 2021', nowYear + new Date().getUTCMonth() / 12 - 2021],
    ['2 years 3 months', 2.25],
    ['3 yrs', 3],
    ['18 months', 1.5],
    ['not a date at all', 0],
    ['', 0],
    [null, 0],
    [undefined, 0],
  ])('parses %j as ~%p years', (input, expected) => {
    expect(parseDurationToYears(input)).toBeCloseTo(expected, 1);
  });

  it('never returns a negative duration for a reversed/garbage range', () => {
    expect(parseDurationToYears('Jun 2020 - Jan 2018')).toBe(0);
  });
});

describe('calculateTotalExperienceYears', () => {
  it('sums durations across multiple work_experience entries', () => {
    const workExperience = [
      { duration: 'Jan 2018 - Jun 2020' }, // ~2.42
      { duration: 'Jul 2020 - Present' },
    ];
    const total = calculateTotalExperienceYears(workExperience);
    expect(total).toBeGreaterThan(2.4);
  });

  it('returns 0 for missing/non-array input', () => {
    expect(calculateTotalExperienceYears(undefined)).toBe(0);
    expect(calculateTotalExperienceYears(null)).toBe(0);
    expect(calculateTotalExperienceYears('not an array')).toBe(0);
  });

  it('ignores entries with unparseable durations rather than throwing', () => {
    const workExperience = [{ duration: 'garbage' }, { duration: '2 years' }];
    expect(calculateTotalExperienceYears(workExperience)).toBe(2);
  });

  it('filters out implausible single-stint outliers', () => {
    const workExperience = [{ duration: '1800 - 2020' }];
    expect(calculateTotalExperienceYears(workExperience)).toBe(0);
  });
});

describe('extractJobExperienceRequirement', () => {
  it('parses an explicit numeric range', () => {
    expect(extractJobExperienceRequirement('Looking for 3-5 years of experience')).toEqual({
      min: 3, max: 5, approximate: false,
    });
  });

  it('parses an open-ended minimum ("5+ years")', () => {
    expect(extractJobExperienceRequirement('5+ years required')).toEqual({
      min: 5, max: null, approximate: false,
    });
  });

  it('parses "minimum X years" phrasing', () => {
    expect(extractJobExperienceRequirement('Minimum of 2 years experience needed')).toEqual({
      min: 2, max: null, approximate: false,
    });
  });

  it('parses "at least X years" phrasing', () => {
    expect(extractJobExperienceRequirement('Must have at least 3 years experience')).toEqual({
      min: 3, max: null, approximate: false,
    });
  });

  it('parses a single exact-year phrasing', () => {
    expect(extractJobExperienceRequirement('4 years of experience required')).toEqual({
      min: 4, max: 4, approximate: false,
    });
  });

  it('falls back to a soft title-level range for "senior"', () => {
    expect(extractJobExperienceRequirement('Senior Backend Engineer')).toEqual({
      min: 5, max: null, approximate: true,
    });
  });

  it('falls back to a soft title-level range for "junior"', () => {
    expect(extractJobExperienceRequirement('Junior Developer')).toEqual({
      min: 0, max: 2, approximate: true,
    });
  });

  it('returns null when nothing is detectable', () => {
    expect(extractJobExperienceRequirement('Great communicator and team player wanted')).toBeNull();
  });
});

describe('scoreExperienceFit', () => {
  it('returns "unknown" when there is no detectable requirement', () => {
    expect(scoreExperienceFit(5, null)).toEqual({ tier: 'unknown' });
  });

  it('returns "good" when the candidate is within range', () => {
    expect(scoreExperienceFit(4, { min: 3, max: 5 })).toEqual({ tier: 'good' });
  });

  it('returns "underqualified" when well below the minimum', () => {
    expect(scoreExperienceFit(1, { min: 5, max: null })).toEqual({ tier: 'underqualified' });
  });

  it('tolerates being just under the minimum (0.5yr tolerance)', () => {
    expect(scoreExperienceFit(4.6, { min: 5, max: null })).toEqual({ tier: 'good' });
  });

  it('returns "overqualified" only once well past the max, with a generous margin', () => {
    // max=2, margin=4 -> overqualified only once candidateYears > 6
    expect(scoreExperienceFit(7, { min: 0, max: 2 })).toEqual({ tier: 'overqualified' });
    expect(scoreExperienceFit(6, { min: 0, max: 2 })).toEqual({ tier: 'good' });
  });
});

describe('EXPERIENCE_TIER_ORDER', () => {
  it('ranks good first, then unknown, then overqualified, then underqualified', () => {
    expect(EXPERIENCE_TIER_ORDER.good).toBeLessThan(EXPERIENCE_TIER_ORDER.unknown);
    expect(EXPERIENCE_TIER_ORDER.unknown).toBeLessThan(EXPERIENCE_TIER_ORDER.overqualified);
    expect(EXPERIENCE_TIER_ORDER.overqualified).toBeLessThan(EXPERIENCE_TIER_ORDER.underqualified);
  });
});

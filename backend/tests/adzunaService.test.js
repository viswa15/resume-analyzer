// backend/tests/adzunaService.test.js
const { scoreJobAgainstResume, findJobsForResume } = require('../services/adzunaService');

describe('scoreJobAgainstResume', () => {
  it('scores against what the JOB needs, not the resume\'s full skill list', () => {
    const resume = {
      resume_text: 'Skilled in Python and Django, with some exposure to Docker.',
      technical_skills: [
        'Python', 'Django', 'Docker',
        ...Array.from({ length: 20 }, (_, i) => `FillerSkill${i}`), // a long, mostly-irrelevant list
      ],
    };
    const job = { title: 'Python Developer', description: 'We need Python, Django, and Kubernetes experience.' };

    const { score, matchedSkills, missingSkills } = scoreJobAgainstResume(job, resume);

    expect(matchedSkills.sort()).toEqual(['Django', 'Python'].sort());
    expect(missingSkills).toEqual(['Kubernetes']);
    // 2 of the job's 3 recognized requirements are covered - not diluted by
    // the resume's 20+ unrelated filler skills.
    expect(score).toBe(67);
  });

  it('matches skills despite punctuation/casing differences in the job text', () => {
    const resume = {
      resume_text: 'Experienced with React, Node, and JavaScript.',
      technical_skills: ['React.js', 'Node.js', 'JavaScript'],
    };
    const job = {
      title: 'Full Stack Developer',
      description: 'We need someone strong in React-JS and Node Js, plus general Javascript.',
    };
    const { matchedSkills } = scoreJobAgainstResume(job, resume);
    expect(matchedSkills).toEqual(expect.arrayContaining(['React.js', 'Node.js', 'JavaScript']));
  });

  it('does not confuse "Java" with "JavaScript" in either direction', () => {
    const javaResume = { resume_text: 'Java developer.', technical_skills: ['Java'] };
    const jsJob = { title: 'Frontend Engineer', description: 'Strong JavaScript skills needed.' };
    expect(scoreJobAgainstResume(jsJob, javaResume).matchedSkills).not.toContain('Java');

    const jsResume = { resume_text: 'JavaScript developer.', technical_skills: ['JavaScript'] };
    const javaJob = { title: 'Backend Engineer', description: 'Strong Java skills needed.' };
    expect(scoreJobAgainstResume(javaJob, jsResume).matchedSkills).not.toContain('JavaScript');
  });

  it('matches symbol-heavy languages via the alias list', () => {
    const resume = { resume_text: 'C++ and C# developer.', technical_skills: ['C++', 'C#'] };
    const job = { title: 'Backend Engineer', description: 'Strong C++ and C# experience required.' };
    const { matchedSkills } = scoreJobAgainstResume(job, resume);
    expect(matchedSkills.sort()).toEqual(['C#', 'C++'].sort());
  });

  it('does not false-positive match "C++"/"C#" against plain "C" mentions', () => {
    const resume = { resume_text: 'C++ and C# developer.', technical_skills: ['C++', 'C#'] };
    const job = { title: 'Embedded Engineer', description: 'Experience with the C programming language.' };
    const { matchedSkills, missingSkills } = scoreJobAgainstResume(job, resume);
    expect(matchedSkills).toHaveLength(0);
    // "C" itself is in the taxonomy and IS asked for by this job, but the
    // resume's "C++"/"C#" don't count as having plain "C".
    expect(missingSkills).toContain('C');
  });

  it('reports a job requirement the resume does not have as missing, and scores it down', () => {
    const resume = { resume_text: 'Python developer with no cloud experience.', technical_skills: ['Python'] };
    const job = { title: 'Cloud Engineer', description: 'Looking for Python and AWS and Kubernetes experience.' };
    const { score, matchedSkills, missingSkills } = scoreJobAgainstResume(job, resume);
    expect(matchedSkills).toEqual(['Python']);
    expect(missingSkills.sort()).toEqual(['AWS', 'Kubernetes'].sort());
    expect(score).toBe(33);
  });

  it('returns a 0/empty result when the job text has no recognizable skills', () => {
    const resume = { resume_text: 'Python developer.', technical_skills: ['Python'] };
    const job = { title: 'Team Player Wanted', description: 'Must be a great communicator and team player.' };
    expect(scoreJobAgainstResume(job, resume)).toEqual({ score: 0, matchedSkills: [], missingSkills: [] });
  });

  it('returns a 0 score for a resume with no skills and no matching text', () => {
    const resume = { resume_text: '', technical_skills: [] };
    const job = { title: 'Python Developer', description: 'Looking for Python experience.' };
    const { score, matchedSkills } = scoreJobAgainstResume(job, resume);
    expect(matchedSkills).toHaveLength(0);
    expect(score).toBe(0);
  });
});

describe('findJobsForResume', () => {
  const mockAdzunaResponse = (results) => ({
    ok: true,
    json: async () => ({ results }),
  });

  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, ADZUNA_APP_ID: 'test-id', ADZUNA_APP_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('ranks experience fit ahead of skill score, and reports candidateExperienceYears', async () => {
    // Candidate has ~2 years of Python experience.
    const resume = {
      resume_text: 'Python developer.',
      technical_skills: ['Python'],
      work_experience: [{ duration: 'Jan 2022 - Jan 2024' }],
    };

    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([
      // Higher skill score, but asks for 8+ years - way underqualified.
      {
        id: '1',
        title: 'Senior Python Engineer',
        description: 'Requires 8+ years of Python and Django experience.',
      },
      // Lower skill score, but experience requirement fits (0-3 years).
      {
        id: '2',
        title: 'Junior Python Developer',
        description: 'Looking for a junior Python developer, 0-3 years experience.',
      },
    ]));

    const { jobs, candidateExperienceYears } = await findJobsForResume(resume);

    expect(candidateExperienceYears).toBeCloseTo(2, 1);
    // The experience-fit job comes first even though it scores lower on skills.
    expect(jobs[0].id).toBe('2');
    expect(jobs[0].experienceFit.tier).toBe('good');
    expect(jobs[1].id).toBe('1');
    expect(jobs[1].experienceFit.tier).toBe('underqualified');
  });

  it('treats postings with no detectable experience requirement as neutral ("unknown"), ranked by skill score', async () => {
    const resume = {
      resume_text: 'Python and AWS developer.',
      technical_skills: ['Python', 'AWS'],
      work_experience: [{ duration: 'Jan 2020 - Jan 2021' }],
    };

    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([
      { id: 'low', title: 'Developer', description: 'Must be a great communicator and team player.' },
      { id: 'high', title: 'Python Developer', description: 'Looking for Python and AWS skills.' },
    ]));

    const { jobs } = await findJobsForResume(resume);
    expect(jobs.every((job) => job.experienceFit.tier === 'unknown')).toBe(true);
    // Within the same (unknown) tier, higher skill score still sorts first.
    expect(jobs[0].id).toBe('high');
  });

  it('falls back to 0 candidateExperienceYears when work_experience is missing/unparseable', async () => {
    const resume = { resume_text: 'Python developer.', technical_skills: ['Python'] };
    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([]));

    const { candidateExperienceYears } = await findJobsForResume(resume);
    expect(candidateExperienceYears).toBe(0);
  });

  it('forwards maxDaysOld/salaryMin/salaryMax/employmentType to Adzuna as its own server-side filters', async () => {
    const resume = { resume_text: 'Python developer.', technical_skills: ['Python'] };
    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([]));

    await findJobsForResume(resume, {
      maxDaysOld: 15,
      salaryMin: 50000,
      salaryMax: 120000,
      employmentType: 'full_time',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(requestedUrl.searchParams.get('max_days_old')).toBe('15');
    expect(requestedUrl.searchParams.get('salary_min')).toBe('50000');
    expect(requestedUrl.searchParams.get('salary_max')).toBe('120000');
    expect(requestedUrl.searchParams.get('full_time')).toBe('1');
    // Only the requested employment type flag is set - not the others.
    expect(requestedUrl.searchParams.get('part_time')).toBeNull();
    expect(requestedUrl.searchParams.get('contract')).toBeNull();
    expect(requestedUrl.searchParams.get('permanent')).toBeNull();
  });

  it('omits the Adzuna filter params entirely when no filters are given', async () => {
    const resume = { resume_text: 'Python developer.', technical_skills: ['Python'] };
    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([]));

    await findJobsForResume(resume);

    const requestedUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(requestedUrl.searchParams.has('max_days_old')).toBe(false);
    expect(requestedUrl.searchParams.has('salary_min')).toBe(false);
    expect(requestedUrl.searchParams.has('salary_max')).toBe(false);
    expect(requestedUrl.searchParams.has('full_time')).toBe(false);
    expect(requestedUrl.searchParams.has('part_time')).toBe(false);
    expect(requestedUrl.searchParams.has('contract')).toBe(false);
    expect(requestedUrl.searchParams.has('permanent')).toBe(false);
  });

  it('ignores an invalid/unrecognized employmentType rather than sending a bogus param', async () => {
    const resume = { resume_text: 'Python developer.', technical_skills: ['Python'] };
    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([]));

    await findJobsForResume(resume, { employmentType: 'weekend-only' });

    const requestedUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(requestedUrl.searchParams.has('full_time')).toBe(false);
    expect(requestedUrl.searchParams.has('part_time')).toBe(false);
    expect(requestedUrl.searchParams.has('contract')).toBe(false);
    expect(requestedUrl.searchParams.has('permanent')).toBe(false);
  });

  it('maps contract_time/contract_type through onto each returned job', async () => {
    const resume = { resume_text: 'Python developer.', technical_skills: ['Python'] };
    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([
      { id: '1', title: 'Python Developer', description: 'Python role.', contract_time: 'full_time', contract_type: 'permanent' },
    ]));

    const { jobs } = await findJobsForResume(resume);
    expect(jobs[0].contractTime).toBe('full_time');
    expect(jobs[0].contractType).toBe('permanent');
  });

  it('runs an unranked search with neutral placeholders when resume is null/undefined - e.g. searching for someone else', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([
      { id: '1', title: 'Backend Engineer', description: 'We need Python and Django.', created: '2024-01-01T00:00:00Z' },
      { id: '2', title: 'Frontend Engineer', description: 'We need React.', created: '2024-06-01T00:00:00Z' },
    ]));

    const { jobs, candidateExperienceYears } = await findJobsForResume(null, { what: 'engineer' });

    expect(candidateExperienceYears).toBeNull();
    // No resume to score against - every job gets the same neutral fields.
    for (const job of jobs) {
      expect(job.score).toBe(0);
      expect(job.matchedSkills).toEqual([]);
      expect(job.missingSkills).toEqual([]);
      expect(job.experienceFit).toEqual({ tier: 'unknown' });
    }
    // With no personalized ranking signal, most-recently-posted sorts first.
    expect(jobs[0].id).toBe('2');
    expect(jobs[1].id).toBe('1');
  });

  it('treats undefined the same as null for the resume-optional path', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockAdzunaResponse([]));
    const { candidateExperienceYears } = await findJobsForResume(undefined, { what: 'engineer' });
    expect(candidateExperienceYears).toBeNull();
  });
});

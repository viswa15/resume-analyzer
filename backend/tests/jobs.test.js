// backend/tests/jobs.test.js
jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../services/adzunaService', () => ({ findJobsForResume: jest.fn() }));

const request = require('supertest');
const db = require('../db');
const { findJobsForResume } = require('../services/adzunaService');
const { signToken } = require('../utils/jwt');
const app = require('../app');

const authHeader = () => `Bearer ${signToken({ sub: 1, email: 'a@b.com' })}`;

describe('GET /api/jobs/search', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/jobs/search');
    expect(res.status).toBe(401);
  });

  it('searches without a resume when no resumeId is given - the default, unranked search', async () => {
    findJobsForResume.mockResolvedValue({
      jobs: [{ id: 'j1', title: 'Backend Engineer', score: 0, matchedSkills: [], missingSkills: [], experienceFit: { tier: 'unknown' } }],
      candidateExperienceYears: null,
    });

    const res = await request(app).get('/api/jobs/search?what=backend%20engineer').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(db.query).not.toHaveBeenCalled();
    expect(findJobsForResume).toHaveBeenCalledWith(null, expect.objectContaining({ what: 'backend engineer' }));
    expect(res.body.candidateExperienceYears).toBeNull();
    expect(res.body.matchedResumeId).toBeNull();
    expect(res.body.data).toHaveLength(1);
  });

  it('ranks against the given resume when resumeId is owned by the caller', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7, user_id: 1, technical_skills: '["python"]' }] });
    findJobsForResume.mockResolvedValue({
      jobs: [{ id: 'j1', title: 'Python Developer', score: 90, matchedSkills: ['python'], missingSkills: [], experienceFit: { tier: 'good' } }],
      candidateExperienceYears: 4,
    });

    const res = await request(app).get('/api/jobs/search?resumeId=7').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(findJobsForResume).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), expect.any(Object));
    expect(res.body.candidateExperienceYears).toBe(4);
    expect(res.body.matchedResumeId).toBe(7);
  });

  it('falls back to an unranked search when resumeId does not belong to the caller (no 404)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    findJobsForResume.mockResolvedValue({ jobs: [], candidateExperienceYears: null });

    const res = await request(app).get('/api/jobs/search?resumeId=999').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(findJobsForResume).toHaveBeenCalledWith(null, expect.any(Object));
    expect(res.body.matchedResumeId).toBeNull();
  });

  it('forwards maxDaysOld/salaryMin/salaryMax/employmentType filters through', async () => {
    findJobsForResume.mockResolvedValue({ jobs: [], candidateExperienceYears: null });

    await request(app)
      .get('/api/jobs/search?maxDaysOld=15&salaryMin=50000&salaryMax=120000&employmentType=full_time')
      .set('Authorization', authHeader());

    expect(findJobsForResume).toHaveBeenCalledWith(null, {
      what: undefined,
      where: undefined,
      maxDaysOld: 15,
      salaryMin: 50000,
      salaryMax: 120000,
      employmentType: 'full_time',
    });
  });
});

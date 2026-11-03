// backend/tests/insights.test.js
jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../services/jdMatchService', () => ({ matchResumeToJob: jest.fn() }));

const request = require('supertest');
const db = require('../db');
const { matchResumeToJob } = require('../services/jdMatchService');
const { topMissingKeywords, buildFunnel } = require('../controllers/insightsController');
const { signToken } = require('../utils/jwt');
const app = require('../app');

const authHeader = () => `Bearer ${signToken({ sub: 1, email: 'a@b.com' })}`;

describe('insights helpers', () => {
  it('ranks missing keywords by frequency, counting each match once', () => {
    const rows = [
      { missing_keywords: ['Docker', 'Docker', 'AWS'] },
      { missing_keywords: ['Docker'] },
      { missing_keywords: ['AWS', 'Go'] },
      { missing_keywords: null },
    ];
    expect(topMissingKeywords(rows)).toEqual([
      { keyword: 'AWS', count: 2 },
      { keyword: 'Docker', count: 2 },
      { keyword: 'Go', count: 1 },
    ]);
  });

  it('builds a funnel with rates relative to submitted applications', () => {
    const funnel = buildFunnel([
      { status: 'saved', count: 5 },
      { status: 'applied', count: 4 },
      { status: 'interviewing', count: 2 },
      { status: 'offer', count: 1 },
      { status: 'rejected', count: 3 },
    ]);
    expect(funnel.total).toBe(15);
    expect(funnel.submitted).toBe(10);
    expect(funnel.interviewRate).toBe(30);
    expect(funnel.offerRate).toBe(10);
    expect(funnel.responseRate).toBe(60);
  });

  it('returns null rates when nothing has been submitted', () => {
    const funnel = buildFunnel([{ status: 'saved', count: 2 }]);
    expect(funnel.submitted).toBe(0);
    expect(funnel.responseRate).toBeNull();
  });
});

describe('GET /api/insights', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/insights')).status).toBe(401);
  });

  it('returns rating history, match history, missing keywords and the funnel', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, file_name: 'a.pdf', uploaded_at: '2026-01-01', resume_rating: 6 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, resume_id: 1, file_name: 'a.pdf', match_score: 55, job_snippet: 'x', missing_keywords: ['Docker'], created_at: '2026-01-02' }] })
      .mockResolvedValueOnce({ rows: [{ status: 'applied', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ week: '2026-01-05', count: 2 }] });

    const res = await request(app).get('/api/insights').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.resumeRatings).toHaveLength(1);
    expect(res.body.matchHistory[0].match_score).toBe(55);
    expect(res.body.matchHistory[0].missing_keywords).toBeUndefined();
    expect(res.body.topMissingKeywords).toEqual([{ keyword: 'Docker', count: 1 }]);
    expect(res.body.applications.submitted).toBe(2);
    expect(res.body.applications.weekly).toHaveLength(1);
  });
});

describe('POST /api/resumes/:id/match history', () => {
  it('records the result and still responds if recording fails', async () => {
    matchResumeToJob.mockResolvedValue({ match_score: 72, missing_keywords: ['Kubernetes'], matched_keywords: [] });
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 3, resume_text: 'resume' }] })
      .mockRejectedValueOnce(new Error('table missing'));

    const res = await request(app)
      .post('/api/resumes/3/match')
      .set('Authorization', authHeader())
      .send({ jobDescription: 'A job description that is definitely long enough to pass validation.' });

    expect(res.status).toBe(200);
    expect(res.body.match_score).toBe(72);
  });

  it('inserts a history row on success', async () => {
    matchResumeToJob.mockResolvedValue({ match_score: 81, missing_keywords: ['Go'] });
    db.query.mockResolvedValueOnce({ rows: [{ id: 3, resume_text: 'resume' }] }).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/resumes/3/match')
      .set('Authorization', authHeader())
      .send({ jobDescription: 'A job description that is definitely long enough to pass validation.' });

    expect(res.status).toBe(200);
    const insert = db.query.mock.calls[1];
    expect(insert[0]).toMatch(/INSERT INTO match_history/);
    expect(insert[1][2]).toBe(81);
  });
});

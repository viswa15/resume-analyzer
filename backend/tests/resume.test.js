// backend/tests/resume.test.js
jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../services/analysisService', () => ({
  parsePdf: jest.fn(),
  analyzeResumeWithAI: jest.fn(),
}));
jest.mock('../services/rewriteService', () => ({ rewriteBulletPoint: jest.fn() }));
jest.mock('../services/adzunaService', () => ({ findJobsForResume: jest.fn() }));
jest.mock('../services/coverLetterService', () => ({ generateCoverLetter: jest.fn() }));

const request = require('supertest');
const db = require('../db');
const { parsePdf, analyzeResumeWithAI } = require('../services/analysisService');
const { rewriteBulletPoint } = require('../services/rewriteService');
const { findJobsForResume } = require('../services/adzunaService');
const { generateCoverLetter } = require('../services/coverLetterService');
const { signToken } = require('../utils/jwt');
const app = require('../app');

const authHeader = () => `Bearer ${signToken({ sub: 1, email: 'a@b.com' })}`;

describe('Resume routes', () => {
  it('requires auth for listing resumes', async () => {
    const res = await request(app).get('/api/resumes');
    expect(res.status).toBe(401);
  });

  it('returns a paginated list of the caller\'s resumes', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, file_name: 'r.pdf' }] });

    const res = await request(app).get('/api/resumes').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('rejects upload with no file attached', async () => {
    const res = await request(app).post('/api/resumes/upload').set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('uploads and analyzes a resume', async () => {
    parsePdf.mockResolvedValue('Resume text long enough to pass the minimum length check.');
    analyzeResumeWithAI.mockResolvedValue({
      name: 'Jane Doe',
      email: 'jane@example.com',
      resume_rating: 8,
      work_experience: [],
      education: [],
      technical_skills: [],
      soft_skills: [],
      projects: [],
      certifications: [],
      upskill_suggestions: [],
    });
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, file_name: 'resume.pdf' }] });

    const res = await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', authHeader())
      .attach('resume', Buffer.from('%PDF-1.4 fake pdf content'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.file_name).toBe('resume.pdf');
  });

  it('returns 404 for a resume the caller does not own', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/resumes/999').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('rewrites a bullet point', async () => {
    rewriteBulletPoint.mockResolvedValue({
      rewritten: 'Improved bullet.',
      alternatives: [],
      why: 'Added a strong action verb.',
    });

    const res = await request(app)
      .post('/api/resumes/rewrite')
      .set('Authorization', authHeader())
      .send({ bullet: 'Did stuff at company.' });

    expect(res.status).toBe(200);
    expect(res.body.rewritten).toBe('Improved bullet.');
  });

  it('rejects an empty bullet on rewrite', async () => {
    const res = await request(app)
      .post('/api/resumes/rewrite')
      .set('Authorization', authHeader())
      .send({ bullet: '' });

    expect(res.status).toBe(400);
  });

  it('requires auth for job matches', async () => {
    const res = await request(app).get('/api/resumes/1/jobs');
    expect(res.status).toBe(401);
  });

  it('returns ranked job matches for an owned resume', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, technical_skills: '["node.js"]' }] });
    findJobsForResume.mockResolvedValue({
      jobs: [
        { id: 'j1', title: 'Backend Engineer', company: 'Acme', location: 'Remote', description: '', url: null, salaryMin: null, salaryMax: null, postedAt: null, category: null, score: 80, matchedSkills: ['node.js'] },
      ],
      candidateExperienceYears: 3.5,
    });

    const res = await request(app).get('/api/resumes/1/jobs').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].score).toBe(80);
    expect(res.body.candidateExperienceYears).toBe(3.5);
  });

  it('returns 404 for job matches on a resume the caller does not own', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/resumes/999/jobs').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('rejects a cover letter request with too short a job description', async () => {
    const res = await request(app)
      .post('/api/resumes/1/cover-letter')
      .set('Authorization', authHeader())
      .send({ jobDescription: 'too short' });

    expect(res.status).toBe(400);
  });

  it('drafts a cover letter for an owned resume', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, resume_text: 'Experienced engineer.' }] });
    generateCoverLetter.mockResolvedValue('Dear Hiring Manager, ...');

    const res = await request(app)
      .post('/api/resumes/1/cover-letter')
      .set('Authorization', authHeader())
      .send({ jobDescription: 'We are looking for a backend engineer with Node.js experience.' });

    expect(res.status).toBe(200);
    expect(res.body.coverLetter).toBe('Dear Hiring Manager, ...');
  });
});

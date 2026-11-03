// backend/tests/ats.test.js
jest.mock('../db', () => ({ query: jest.fn() }));

const request = require('supertest');
const db = require('../db');
const { analyzeAts } = require('../services/atsService');
const { signToken } = require('../utils/jwt');
const app = require('../app');

const authHeader = () => `Bearer ${signToken({ sub: 1, email: 'a@b.com' })}`;

const strongResume = {
  email: 'jane@example.com',
  phone: '+1 415 555 0100',
  linkedin_url: 'https://linkedin.com/in/jane',
  technical_skills: ['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'Python', 'SQL'],
  soft_skills: [],
  work_experience: [
    {
      role: 'Engineer',
      company: 'Acme',
      duration: '2021-2024',
      description: [
        'Reduced API latency by 40% by adding a Redis cache',
        'Led a team of 5 engineers to ship a billing platform',
        'Automated deployments, cutting release time from 2 hours to 10 minutes',
        'Designed a REST API serving 1M requests per day',
        'Mentored 3 junior developers through quarterly goals',
        'Migrated 12 services to Kubernetes',
      ],
    },
  ],
  resume_text: [
    'Jane Doe', 'jane@example.com | +1 415 555 0100', 'Summary', 'Backend engineer.',
    'Experience', 'Engineer at Acme', 'Education', 'BSc Computer Science', 'Skills', 'JavaScript React Node.js',
    Array(300).fill('word').join(' '),
  ].join('\n'),
};

describe('analyzeAts', () => {
  it('scores a well-formed resume highly', () => {
    const report = analyzeAts(strongResume);
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.grade).toBe('A');
    expect(report.checks.every((c) => c.status === 'pass')).toBe(true);
    expect(report.keywordCoverage).toBeNull();
  });

  it('flags missing sections, contact info and bullets on a weak resume', () => {
    const report = analyzeAts({ resume_text: 'just a few words here', work_experience: [], technical_skills: [] });
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    expect(byId.contact).toBe('fail');
    expect(byId.sections).toBe('fail');
    expect(byId.bullets).toBe('fail');
    expect(byId.length).toBe('fail');
    expect(report.score).toBeLessThan(40);
    expect(report.grade).toBe('F');
  });

  it('detects passive phrasing and unquantified bullets', () => {
    const report = analyzeAts({
      ...strongResume,
      work_experience: [{ description: ['Responsible for the website', 'Worked on backend things', 'Helped with deployments'] }],
    });
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    expect(byId.weak_phrases).toBe('fail');
    expect(byId.quantified).toBe('fail');
    expect(byId.action_verbs).toBe('fail');
  });

  it('reports keyword coverage against a job description', () => {
    const report = analyzeAts(strongResume, {
      jobDescription: 'We need someone with React, Kubernetes, and PostgreSQL experience.',
    });
    expect(report.keywordCoverage.matched).toEqual(expect.arrayContaining(['React', 'PostgreSQL']));
    expect(report.keywordCoverage.missing).toContain('Kubernetes');
    expect(report.keywordCoverage.percent).toBeGreaterThan(0);
    expect(report.keywordCoverage.percent).toBeLessThan(100);
  });
});

describe('POST /api/resumes/:id/ats', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/resumes/1/ats').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for a resume the caller does not own', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/resumes/9/ats').set('Authorization', authHeader()).send({});
    expect(res.status).toBe(404);
  });

  it('returns a report for an owned resume', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, ...strongResume }] });
    const res = await request(app)
      .post('/api/resumes/1/ats')
      .set('Authorization', authHeader())
      .send({ jobDescription: 'Looking for a React developer with Docker skills.' });
    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThan(0);
    expect(res.body.keywordCoverage.matched).toEqual(expect.arrayContaining(['React', 'Docker']));
  });
});

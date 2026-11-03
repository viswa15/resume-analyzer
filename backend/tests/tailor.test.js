// backend/tests/tailor.test.js
jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../utils/geminiClient', () => ({
  buildModelChain: jest.fn(() => []),
  generateWithRetry: jest.fn(),
  streamWithFallback: jest.fn(),
}));

const request = require('supertest');
const db = require('../db');
const { generateWithRetry } = require('../utils/geminiClient');
const { normalizeTailored, tailoredToText, tailorResume } = require('../services/tailorService');
const { renderResumePdf, safe } = require('../services/pdfService');
const { signToken } = require('../utils/jwt');
const app = require('../app');

const authHeader = () => `Bearer ${signToken({ sub: 1, email: 'a@b.com' })}`;

const resume = {
  id: 5,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1 555 0100',
  linkedin_url: 'linkedin.com/in/jane',
  portfolio_url: null,
  resume_text: 'Experience\nEngineer at Acme\nEducation\nBSc\nSkills\nJavaScript ' + 'word '.repeat(300),
  technical_skills: ['JavaScript', 'React', 'Docker'],
  soft_skills: [],
  certifications: ['AWS CCP'],
  education: [{ degree: 'BSc CS', institution: 'MIT', graduation_year: 2019 }],
  projects: [{ name: 'Blog', description: 'A blog', technologies: ['React'] }],
  work_experience: [
    { role: 'Engineer', company: 'Acme', duration: '2021-2024', description: ['Built a dashboard', 'Fixed bugs'] },
    { role: 'Intern', company: 'Beta', duration: '2020', description: ['Wrote tests'] },
  ],
};

const modelOutput = {
  headline: 'Frontend Engineer',
  summary: 'Engineer with React experience.',
  skills: ['React', 'JavaScript'],
  work_experience: [
    { role: 'INVENTED TITLE', company: 'Fake Corp', duration: '1999', bullets: ['Built a React dashboard used by 40 analysts'] },
    { role: 'Intern', company: 'Beta', duration: '2020', bullets: ['Wrote unit tests'] },
  ],
  changes: ['Led with React work'],
};

describe('normalizeTailored', () => {
  it('restores role/company/duration and contact details from the stored resume', () => {
    const doc = normalizeTailored(modelOutput, resume);
    expect(doc.work_experience[0]).toMatchObject({ role: 'Engineer', company: 'Acme', duration: '2021-2024' });
    expect(doc.work_experience[0].bullets).toEqual(['Built a React dashboard used by 40 analysts']);
    expect(doc.contact).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com', linkedin: 'linkedin.com/in/jane' });
    expect(doc.education[0]).toEqual({ degree: 'BSc CS', institution: 'MIT', year: '2019' });
  });

  it('falls back to stored skills, projects and certifications when the model omits them', () => {
    const doc = normalizeTailored({ work_experience: modelOutput.work_experience }, resume);
    expect(doc.skills).toEqual(['JavaScript', 'React', 'Docker']);
    expect(doc.projects[0].name).toBe('Blog');
    expect(doc.certifications).toEqual(['AWS CCP']);
  });

  it('survives garbage model output', () => {
    const doc = normalizeTailored('nope', resume);
    expect(doc.work_experience).toEqual([]);
    expect(doc.contact.name).toBe('Jane Doe');
  });
});

describe('tailorResume', () => {
  it('returns the document plus a before/after comparison', async () => {
    generateWithRetry.mockResolvedValue('```json\n' + JSON.stringify(modelOutput) + '\n```');
    const { document, comparison } = await tailorResume(resume, 'We want React and Docker experience for a frontend role.');
    expect(document.headline).toBe('Frontend Engineer');
    expect(comparison.before).toHaveProperty('atsScore');
    expect(comparison.after).toHaveProperty('keywordPercent');
    expect(tailoredToText(document)).toContain('Experience');
  });

  it('rejects unparseable model output', async () => {
    generateWithRetry.mockResolvedValue('not json');
    await expect(tailorResume(resume, 'A long enough job description for React roles.')).rejects.toThrow(/valid JSON/);
  });
});

describe('renderResumePdf', () => {
  it('produces a real PDF, including multi-page content', async () => {
    const doc = normalizeTailored(modelOutput, resume);
    doc.work_experience[0].bullets = Array.from({ length: 60 }, (_, i) => `Delivered result number ${i} with measurable impact across teams`);
    const buffer = await renderResumePdf(doc);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1500);
    expect(buffer.toString('latin1')).toMatch(/\/Count [2-9]/); // spilled onto more than one page
  });

  it('replaces characters Helvetica cannot draw', () => {
    expect(safe('café – ok \u{1F600} 中')).toBe('café – ok ? ?');
  });
});

describe('tailor routes', () => {
  const jd = 'A sufficiently long job description asking for React and Docker skills.';

  it('requires auth', async () => {
    expect((await request(app).post('/api/resumes/5/tailor').send({ jobDescription: jd })).status).toBe(401);
  });

  it('validates the job description', async () => {
    const res = await request(app).post('/api/resumes/5/tailor').set('Authorization', authHeader()).send({ jobDescription: 'short' });
    expect(res.status).toBe(400);
  });

  it('tailors an owned resume', async () => {
    db.query.mockResolvedValueOnce({ rows: [resume] });
    generateWithRetry.mockResolvedValue(JSON.stringify(modelOutput));
    const res = await request(app).post('/api/resumes/5/tailor').set('Authorization', authHeader()).send({ jobDescription: jd });
    expect(res.status).toBe(200);
    expect(res.body.document.contact.name).toBe('Jane Doe');
    expect(res.body.comparison.after).toBeDefined();
  });

  it('returns 404 when tailoring a resume the caller does not own', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/resumes/5/tailor').set('Authorization', authHeader()).send({ jobDescription: jd });
    expect(res.status).toBe(404);
  });

  it('downloads a PDF for an owned resume', async () => {
    db.query.mockResolvedValueOnce({ rows: [resume] });
    const document = normalizeTailored(modelOutput, resume);
    const res = await request(app)
      .post('/api/resumes/5/tailor/pdf')
      .set('Authorization', authHeader())
      .send({ document })
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('jane-doe-tailored.pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects an oversized document', async () => {
    const document = normalizeTailored(modelOutput, resume);
    document.summary = 'x'.repeat(5000);
    const res = await request(app).post('/api/resumes/5/tailor/pdf').set('Authorization', authHeader()).send({ document });
    expect(res.status).toBe(400);
  });
});

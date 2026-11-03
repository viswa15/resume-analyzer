// backend/tests/applications.test.js
jest.mock('../db', () => ({ query: jest.fn() }));

const request = require('supertest');
const db = require('../db');
const { signToken } = require('../utils/jwt');
const app = require('../app');

const authHeader = () => `Bearer ${signToken({ sub: 1, email: 'a@b.com' })}`;

describe('Application tracker routes', () => {
  it('requires auth for listing applications', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  it('lists the caller\'s applications', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, company: 'Acme', role_title: 'Engineer', status: 'saved' }] });

    const res = await request(app).get('/api/applications').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('rejects creating an application without a company or role', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', authHeader())
      .send({ company: '' });

    expect(res.status).toBe(400);
  });

  it('creates an application', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, company: 'Acme', role_title: 'Engineer', status: 'saved' }] });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', authHeader())
      .send({ company: 'Acme', roleTitle: 'Engineer' });

    expect(res.status).toBe(201);
    expect(res.body.company).toBe('Acme');
  });

  it('rejects creating an application against a resume the caller does not own', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // resume ownership check fails

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', authHeader())
      .send({ company: 'Acme', roleTitle: 'Engineer', resumeId: 999 });

    expect(res.status).toBe(404);
  });

  it('updates an application\'s status, scoped to its owner', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, status: 'saved' }] }) // ownership check
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, status: 'applied' }] }); // update

    const res = await request(app)
      .patch('/api/applications/1')
      .set('Authorization', authHeader())
      .send({ status: 'applied' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('applied');
  });

  it('returns 404 updating an application the caller does not own', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/applications/999')
      .set('Authorization', authHeader())
      .send({ status: 'applied' });

    expect(res.status).toBe(404);
  });

  it('deletes an application, scoped to its owner', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // ownership check
      .mockResolvedValueOnce({ rows: [] }); // delete

    const res = await request(app).delete('/api/applications/1').set('Authorization', authHeader());

    expect(res.status).toBe(204);
  });
});

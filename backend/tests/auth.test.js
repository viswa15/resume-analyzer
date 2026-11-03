// backend/tests/auth.test.js
jest.mock('../db', () => ({ query: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../db');
const app = require('../app');

describe('Auth routes', () => {
  it('registers a new user and returns a token', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // no existing user with this email
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: 'a@b.com', name: 'A', created_at: new Date().toISOString() }],
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('a@b.com');
  });

  it('rejects registration with a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: '123' });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate email registration', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@b.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const hash = await bcrypt.hash('password123', 10);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'a@b.com', password_hash: hash, name: 'A', created_at: new Date().toISOString() }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with the wrong password', async () => {
    const hash = await bcrypt.hash('password123', 10);
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@b.com', password_hash: hash }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated access to /me', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

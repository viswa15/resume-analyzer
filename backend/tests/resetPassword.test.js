// backend/tests/resetPassword.test.js
const bcrypt = require('bcryptjs');
const { resetPassword, listEmails } = require('../db/reset-password');

describe('resetPassword', () => {
  it('stores a bcrypt hash of the new password for the matching email (case-insensitive)', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ id: 7, email: 'Jane@Example.com' }] }) };

    const user = await resetPassword(db, ' jane@example.com ', 'a-new-password');

    expect(user).toEqual({ id: 7, email: 'Jane@Example.com' });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE users SET password_hash/);
    expect(sql).toMatch(/LOWER\(email\) = LOWER\(\$2\)/);
    expect(params[1]).toBe('jane@example.com'); // trimmed
    expect(params[0]).not.toContain('a-new-password'); // never stored in plain text
    expect(await bcrypt.compare('a-new-password', params[0])).toBe(true); // the login check will accept it
  });

  it('returns null when no account has that email', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    expect(await resetPassword(db, 'nobody@example.com', 'a-new-password')).toBeNull();
  });

  it('rejects passwords shorter than the registration minimum, without touching the database', async () => {
    const db = { query: jest.fn() };
    await expect(resetPassword(db, 'a@b.com', 'short')).rejects.toThrow(/at least 8/);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('requires an email', async () => {
    await expect(resetPassword({ query: jest.fn() }, '', 'a-new-password')).rejects.toThrow(/email/i);
  });
});

describe('listEmails', () => {
  it('returns the accounts in creation order', async () => {
    const rows = [{ email: 'a@b.com', name: 'A' }];
    const db = { query: jest.fn().mockResolvedValue({ rows }) };
    expect(await listEmails(db)).toEqual(rows);
    expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY created_at/);
  });
});

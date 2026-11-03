// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const db = require('../db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.created_at,
});

/**
 * Registers a new user account.
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  const existing = await db.query('SELECT id FROM users WHERE email = $1;', [email]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, created_at;`,
    [email, passwordHash, name || null]
  );

  const user = rows[0];
  const token = signToken({ sub: user.id, email: user.email });

  res.status(201).json({ token, user: toPublicUser(user) });
});

/**
 * Logs an existing user in and returns a JWT.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1;', [email]);
  const user = rows[0];

  // Deliberately vague on which part was wrong, to avoid leaking whether an email is registered.
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.status(200).json({ token, user: toPublicUser(user) });
});

/**
 * Returns the currently authenticated user's profile.
 */
const me = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, email, name, created_at FROM users WHERE id = $1;',
    [req.user.id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'User not found.');
  }
  res.status(200).json(toPublicUser(rows[0]));
});

module.exports = { register, login, me };

// backend/config/env.js
require('dotenv').config();

const REQUIRED_ALWAYS = ['JWT_SECRET'];
const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'GOOGLE_API_KEY'];

function assertEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];

  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key]) missing.push(key);
  }
  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!process.env[key] && !missing.includes(key)) missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy backend/.env.example to backend/.env and fill these in.'
    );
  }
}

module.exports = {
  assertEnv,
  isProduction: process.env.NODE_ENV === 'production',
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

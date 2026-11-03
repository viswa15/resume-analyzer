// backend/tests/setupEnv.js
// Ensures the app has everything config/env.js needs before any test file
// requires app.js, without touching a developer's real .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-key';

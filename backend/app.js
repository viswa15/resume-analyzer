// backend/app.js
//
// The Express app itself, kept separate from server.js so tests can import
// it with supertest without opening a real network port or requiring a
// live database/Gemini connection.
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const jobRoutes = require('./routes/jobRoutes');
const insightsRoutes = require('./routes/insightsRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Render (and most PaaS hosts) sit behind one reverse proxy; trust it so
// req.ip is the real client and rate limits aren't shared by every user.
app.set('trust proxy', 1);

// Comma-separated allowlist (e.g. your Vercel URL). Unset = allow any origin.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)
  : null;

app.use(helmet());
app.use(cors(corsOrigins ? { origin: corsOrigins } : undefined));
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

try {
  const openapiDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
} catch (err) {
  logger.warn(`Could not load API docs: ${err.message}`);
}

app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/insights', insightsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Must be registered last: Express recognizes error middleware by its 4-arg signature.
app.use(errorHandler);

module.exports = app;

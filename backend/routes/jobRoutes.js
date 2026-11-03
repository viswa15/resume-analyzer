// backend/routes/jobRoutes.js
const express = require('express');
const jobController = require('../controllers/jobController');
const requireAuth = require('../middleware/auth');
const { jobsLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Job search still requires a signed-in user (it spends the server's Adzuna
// quota and shares its rate limiter with /resumes/:id/jobs), but - unlike
// that route - does not require a resume at all. See jobController.js.
router.use(requireAuth);

router.get('/search', jobsLimiter, jobController.searchJobs);

module.exports = router;

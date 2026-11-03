// backend/routes/insightsRoutes.js
const express = require('express');
const insightsController = require('../controllers/insightsController');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', insightsController.getInsights);

module.exports = router;

// backend/routes/applicationRoutes.js
const express = require('express');
const applicationController = require('../controllers/applicationController');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createApplicationSchema, updateApplicationSchema } = require('../validators/applicationValidators');

const router = express.Router();

// Every application-tracker route requires a signed-in user; applications
// are always scoped to their owner, same convention as resumeRoutes.
router.use(requireAuth);

router.get('/', applicationController.getAllApplications);
router.post('/', validate(createApplicationSchema), applicationController.createApplication);
router.patch('/:id', validate(updateApplicationSchema), applicationController.updateApplication);
router.delete('/:id', applicationController.deleteApplication);

module.exports = router;

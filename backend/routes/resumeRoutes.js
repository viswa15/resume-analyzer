// backend/routes/resumeRoutes.js
const express = require('express');
const multer = require('multer');
const resumeController = require('../controllers/resumeController');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { jdMatchSchema, chatSchema, rewriteSchema, coverLetterSchema, atsSchema, tailorSchema, tailoredDocumentSchema } = require('../validators/resumeValidators');
const { uploadLimiter, aiLimiter, jobsLimiter, exportLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Configure multer for file uploads.
// We use memoryStorage to temporarily hold the file in memory as a Buffer.
// This is efficient for passing it directly to the PDF parser without writing to disk.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB file size limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
    }
  },
});

// Every resume route requires a signed-in user; resumes are always scoped to their owner.
router.use(requireAuth);

router.post('/upload', uploadLimiter, upload.single('resume'), resumeController.uploadResume);
router.get('/', resumeController.getAllResumes);
router.post('/rewrite', aiLimiter, validate(rewriteSchema), resumeController.rewriteBullet);
router.get('/:id', resumeController.getResumeById);
router.delete('/:id', resumeController.deleteResume);
router.post('/:id/match', aiLimiter, validate(jdMatchSchema), resumeController.matchJobDescription);
router.post('/:id/tailor', aiLimiter, validate(tailorSchema), resumeController.tailorResumeForJob);
router.post('/:id/tailor/pdf', exportLimiter, validate(tailoredDocumentSchema), resumeController.downloadTailoredPdf);
router.post('/:id/ats', validate(atsSchema), resumeController.checkAts);
router.get('/:id/chat', resumeController.getChatHistory);
router.post('/:id/chat/stream', aiLimiter, validate(chatSchema), resumeController.streamChatMessage);
router.post('/:id/chat', aiLimiter, validate(chatSchema), resumeController.postChatMessage);
router.get('/:id/jobs', jobsLimiter, resumeController.searchJobsForResume);
router.post('/:id/cover-letter', aiLimiter, validate(coverLetterSchema), resumeController.generateResumeCoverLetter);

module.exports = router;

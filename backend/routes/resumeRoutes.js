// backend/routes/resumeRoutes.js

const express = require('express');
const multer = require('multer');
const resumeController = require('../controllers/resumeController');

const router = express.Router();

// Configure multer for file uploads.
// We use memoryStorage to temporarily hold the file in memory as a Buffer.
// This is efficient for passing it directly to the PDF parser without writing to disk.
const storage = multer.memoryStorage();

// Add file filter and limits for security and robustness
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB file size limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true); // Accept the file
    } else {
      cb(new Error('Invalid file type. Only PDF files are allowed.'), false); // Reject the file
    }
  },
});

// Define the API routes
// POST /api/resumes/upload - Handles the file upload and analysis
router.post('/upload', upload.single('resume'), resumeController.uploadResume);

// GET /api/resumes - Retrieves a list of all resumes
router.get('/', resumeController.getAllResumes);

// GET /api/resumes/:id - Retrieves a single resume by its ID
router.get('/:id', resumeController.getResumeById);

module.exports = router;
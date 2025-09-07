// backend/server.js

require('dotenv').config(); // Load environment variables at the very top
const express = require('express');
const cors = require('cors');
const resumeRoutes = require('./routes/resumeRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
// Enable Cross-Origin Resource Sharing for our React frontend
app.use(cors());
// Parse incoming JSON payloads
app.use(express.json());

// --- API Routes ---
// All resume-related routes will be prefixed with /api/resumes
app.use('/api/resumes', resumeRoutes);

// --- Global Error Handling Middleware ---
// A simple but effective way to catch errors from our routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something went wrong!', message: err.message });
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
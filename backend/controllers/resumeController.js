// backend/controllers/resumeController.js

const db = require('../db');
const { parsePdf, analyzeResumeWithAI } = require('../services/analysisService');

/**
 * Handles the resume upload, parsing, analysis, and database insertion.
 */
const uploadResume = async (req, res) => {
  // 1. Validate Input
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please upload a PDF file.' });
  }

  try {
    // 2. Call Service for Business Logic
    const resumeText = await parsePdf(req.file.buffer);
    const analysisData = await analyzeResumeWithAI(resumeText);
    const fileName = req.file.originalname;

    // 3. Database Interaction
    const {
      name, email, phone, linkedin_url, portfolio_url, summary,
      work_experience, education, technical_skills, soft_skills,
      projects, certifications, resume_rating, improvement_areas, upskill_suggestions
    } = analysisData;

    // Using a parameterized query to prevent SQL injection attacks. This is crucial for security.
    const query = `
      INSERT INTO resumes (
        file_name, name, email, phone, linkedin_url, portfolio_url, summary,
        work_experience, education, technical_skills, soft_skills, projects,
        certifications, resume_rating, improvement_areas, upskill_suggestions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;

    const values = [
      fileName, name, email, phone, linkedin_url, portfolio_url, summary,
      JSON.stringify(work_experience || []),
      JSON.stringify(education || []),
      JSON.stringify(technical_skills || []),
      JSON.stringify(soft_skills || []),
      JSON.stringify(projects || []),
      JSON.stringify(certifications || []),
      resume_rating, improvement_areas,
      JSON.stringify(upskill_suggestions || [])
    ];

    const { rows } = await db.query(query, values);

    // 4. Send Response
    res.status(201).json(rows[0]);

  } catch (error) {
    console.error('Error in uploadResume controller:', error);
    res.status(500).json({ error: 'An internal server error occurred while processing the resume.' });
  }
};

/**
 * Fetches all resume records from the database.
 */
const getAllResumes = async (req, res) => {
  try {
    // We select only key fields for the list view to keep the initial payload small.
    // The full data can be fetched when the user clicks 'Details'.
    const query = 'SELECT id, file_name, name, email, uploaded_at, resume_rating FROM resumes ORDER BY uploaded_at DESC;';
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error in getAllResumes controller:', error);
    res.status(500).json({ error: 'Failed to retrieve resumes.' });
  }
};

/**
 * Fetches a single resume by its ID.
 */
const getResumeById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM resumes WHERE id = $1;';
    const { rows } = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found.' });
    }
    
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error in getResumeById controller:', error);
    res.status(500).json({ error: 'Failed to retrieve the resume.' });
  }
};

module.exports = {
  uploadResume,
  getAllResumes,
  getResumeById,
};
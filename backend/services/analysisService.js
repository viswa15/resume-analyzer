// backend/services/analysisService.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
require('dotenv').config();

// Initialize the Google Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Parses a PDF file buffer and extracts its text content.
 * @param {Buffer} pdfBuffer - The buffer containing the PDF file data.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
const parsePdf = async (pdfBuffer) => {
  const data = await pdf(pdfBuffer);
  return data.text;
};

/**
 * Analyzes resume text using the Gemini LLM to extract structured data.
 * @param {string} resumeText - The raw text content of the resume.
 * @returns {Promise<object>} A promise that resolves with the structured JSON data from the LLM.
 */
const analyzeResumeWithAI = async (resumeText) => {
  // This prompt is the most critical part. It's carefully engineered to instruct the AI
  // to return *only* a valid JSON object with the desired structure.
  const prompt = `
    You are an expert HR recruitment specialist with years of experience in technical recruiting.
    Your task is to analyze the following resume text and extract key information into a structured JSON format.
    Do not include any introductory text, explanations, or markdown formatting around the JSON object.
    The output must be a single, valid JSON object and nothing else.

    Resume Text:
    """
    ${resumeText}
    """

    JSON Structure to follow:
    {
      "name": "string | null",
      "email": "string | null",

      "phone": "string | null",
      "linkedin_url": "string | null",
      "portfolio_url": "string | null",
      "summary": "string | null",
      "work_experience": [{ "role": "string", "company": "string", "duration": "string", "description": ["string"] }],
      "education": [{ "degree": "string", "institution": "string", "graduation_year": "string | number" }],
      "technical_skills": ["string"],
      "soft_skills": ["string"],
      "projects": [{ "name": "string", "description": "string", "technologies": ["string"] }],
      "certifications": ["string"],
      "resume_rating": "number (integer from 1 to 10 based on clarity, impact, and completeness)",
      "improvement_areas": "string (Provide a concise paragraph of actionable feedback)",
      "upskill_suggestions": ["string (Suggest 3-5 relevant technologies or skills to learn)"]
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Sometimes, the model might still wrap the JSON in markdown backticks.
  // This cleanup step ensures we get a clean JSON string.
  const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Failed to parse JSON from LLM response:", cleanedText);
    throw new Error("Could not parse AI response into valid JSON.");
  }
};

module.exports = {
  parsePdf,
  analyzeResumeWithAI,
};
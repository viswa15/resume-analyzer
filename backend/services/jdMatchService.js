// backend/services/jdMatchService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { buildModelChain, generateWithRetry } = require('../utils/geminiClient');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const modelChain = buildModelChain(genAI, { responseMimeType: 'application/json', maxOutputTokens: 4096 });

/**
 * Compares a resume against a job description and returns an ATS-style match
 * score, matched/missing keywords, formatting issues, and advice.
 * @param {string} resumeText
 * @param {string} jobDescription
 * @returns {Promise<object>}
 */
const matchResumeToJob = async (resumeText, jobDescription) => {
  const prompt = `
    You are an ATS (Applicant Tracking System) simulator and technical recruiter.
    Compare the RESUME below against the JOB DESCRIPTION and return ONLY a valid JSON
    object, with no markdown formatting or commentary around it.

    RESUME:
    """
    ${resumeText}
    """

    JOB DESCRIPTION:
    """
    ${jobDescription}
    """

    JSON structure to follow exactly:
    {
      "match_score": "number (0-100, overall fit for this specific job)",
      "matched_keywords": ["string (skills/keywords present in both the resume and the JD)"],
      "missing_keywords": ["string (important JD keywords/skills that are absent from the resume)"],
      "ats_issues": ["string (formatting/structure issues that could trip up an ATS parser, e.g. tables, missing sections, non-standard headings, images)"],
      "summary": "string (2-3 sentence honest assessment of fit for this role)",
      "recommendation": "string (concise, concrete advice on what to change to improve the match)"
    }
  `;

  const text = await generateWithRetry(modelChain, prompt);
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error('Failed to parse JSON from JD match response', {
      rawResponsePreview: cleaned.slice(0, 2000),
      rawResponseLength: cleaned.length,
    });
    throw new Error('Could not parse the AI response for the JD match into valid JSON.');
  }
};

module.exports = { matchResumeToJob };

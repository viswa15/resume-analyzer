// backend/services/rewriteService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { buildModelChain, generateWithRetry } = require('../utils/geminiClient');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const modelChain = buildModelChain(genAI, { responseMimeType: 'application/json', maxOutputTokens: 2048 });

/**
 * Rewrites a single resume bullet point into a stronger, more quantified version.
 * @param {string} bullet - the original bullet point text
 * @param {string} [role] - optional role/context, improves the rewrite
 * @returns {Promise<object>}
 */
const rewriteBulletPoint = async (bullet, role) => {
  const prompt = `
    You are an expert resume writer. Rewrite the following resume bullet point so it is
    stronger: start with a strong action verb, and quantify impact wherever plausible.
    Do not invent specific numbers that aren't implied by the original text - if a metric
    is clearly missing but would strengthen the bullet, use a placeholder like "[X%]".
    Keep it to one line. Return ONLY a valid JSON object, no markdown, no commentary.

    ${role ? `Role/context: ${role}` : ''}
    Original bullet: "${bullet}"

    JSON structure to follow exactly:
    {
      "rewritten": "string (the improved bullet point)",
      "alternatives": ["string (1-2 alternative phrasings)"],
      "why": "string (one sentence explaining what was improved)"
    }
  `;

  const text = await generateWithRetry(modelChain, prompt);
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error('Failed to parse JSON from bullet rewrite response', {
      rawResponsePreview: cleaned.slice(0, 2000),
      rawResponseLength: cleaned.length,
    });
    throw new Error('Could not parse the AI response for the bullet rewrite into valid JSON.');
  }
};

module.exports = { rewriteBulletPoint };

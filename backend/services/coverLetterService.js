// backend/services/coverLetterService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { buildModelChain, generateWithRetry } = require('../utils/geminiClient');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// Cover letters are prose, not JSON, so this model chain is left at the
// default (text) response type rather than the 'application/json' mime
// type used by jdMatchService/analysisService.
const modelChain = buildModelChain(genAI, { maxOutputTokens: 1536 });

const TONE_GUIDANCE = {
  professional: 'a polished, professional tone',
  enthusiastic: 'an enthusiastic, energetic tone that still reads as professional',
  concise: 'a tight, no-filler tone - short paragraphs, get straight to the point',
};

/**
 * Drafts a cover letter tailored to a specific job description, grounded in
 * the candidate's actual resume content so it doesn't invent experience.
 * @param {string} resumeText
 * @param {string} jobDescription
 * @param {{ companyName?: string, tone?: 'professional' | 'enthusiastic' | 'concise' }} [options]
 * @returns {Promise<string>} the drafted cover letter as plain text
 */
const generateCoverLetter = async (resumeText, jobDescription, options = {}) => {
  const { companyName, tone = 'professional' } = options;
  const toneInstruction = TONE_GUIDANCE[tone] || TONE_GUIDANCE.professional;

  const prompt = `
    You are an expert career coach writing a cover letter on behalf of a job applicant.
    Use ONLY facts, skills, and experience that actually appear in the RESUME below - never
    invent employers, titles, dates, metrics, or skills that are not present in it.
    Write in ${toneInstruction}. Address the letter generically ("Dear Hiring Manager,")
    since no recipient name is given. Keep it to 3-4 short paragraphs. Do not use
    placeholder brackets like "[Your Name]" - just omit a signature block entirely and
    end after the closing line (e.g. "Sincerely,").

    ${companyName ? `The role is at a company called "${companyName}".` : ''}

    RESUME:
    """
    ${resumeText}
    """

    JOB DESCRIPTION:
    """
    ${jobDescription}
    """

    Return ONLY the cover letter body text - no markdown formatting, no commentary, no headers.
  `;

  const text = await generateWithRetry(modelChain, prompt);
  const cleaned = text.trim();

  if (!cleaned) {
    logger.error('Cover letter generation returned empty text');
    throw new Error('The AI returned an empty cover letter. Please try again.');
  }

  return cleaned;
};

module.exports = { generateCoverLetter };

// backend/services/chatService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { buildModelChain, generateWithRetry, streamWithFallback } = require('../utils/geminiClient');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const modelChain = buildModelChain(genAI);

/**
 * Answers a free-form question grounded in a single resume's full text.
 * The resume is short enough to pass directly as context, so "retrieval"
 * here is simply the whole document rather than a vector search step.
 * @param {string} resumeText
 * @param {string} question
 * @param {{role: string, content: string}[]} history - prior turns, oldest first
 * @returns {Promise<string>}
 */
const buildChatPrompt = (resumeText, question, history = []) => {
  const historyText = history
    .map((m) => `${m.role === 'user' ? 'Asker' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `
    You are a helpful assistant answering questions about ONE specific resume, for either
    a recruiter screening it or the candidate themselves. Base your answers ONLY on the
    resume text provided below. If the answer isn't in the resume, say so honestly rather
    than inventing details. Keep answers concise unless a list is clearly more useful.

    RESUME:
    """
    ${resumeText}
    """
    ${historyText ? `\n    Recent conversation so far:\n    ${historyText}\n` : ''}
    New question: ${question}

    Answer:
  `;

};

const answerQuestionAboutResume = async (resumeText, question, history = []) => {
  const text = await generateWithRetry(modelChain, buildChatPrompt(resumeText, question, history));
  return text.trim();
};

/**
 * Streaming variant: calls onChunk(text) as tokens arrive and resolves with
 * the complete (trimmed) answer once the stream ends.
 */
const streamAnswerAboutResume = async (resumeText, question, history, onChunk) => {
  const full = await streamWithFallback(modelChain, buildChatPrompt(resumeText, question, history), onChunk);
  return full.trim();
};

module.exports = { answerQuestionAboutResume, streamAnswerAboutResume };

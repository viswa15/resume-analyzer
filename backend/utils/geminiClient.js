// backend/utils/geminiClient.js
const logger = require('./logger');
const ApiError = require('./ApiError');
const { createRateLimiter } = require('./rateLimiter');

// Errors worth retrying on the SAME model: transient server/network failures.
// Not retried: 400/401/403/404 and JSON-parse/validation errors - those are
// permanent for a given request and retrying would just waste quota and time.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_MESSAGE = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|timeout/i;

// Self-throttle outbound Gemini calls to (at most) this many per rolling
// minute PER MODEL, shared across every service in the process. Override
// with GEMINI_RPM_LIMIT if your key's actual per-minute quota is different
// (shown in a 429 error body, or https://ai.google.dev/gemini-api/docs/rate-limits).
const RPM_LIMIT = Number(process.env.GEMINI_RPM_LIMIT) || 5;
const limiters = new Map(); // model name -> rate limiter
const limiterFor = (name) => {
  if (!limiters.has(name)) limiters.set(name, createRateLimiter(RPM_LIMIT, 60_000));
  return limiters.get(name);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractStatus = (err) => {
  if (err.status) return Number(err.status);
  const match = (err.message || '').match(/\[(\d{3})\s/);
  return match ? Number(match[1]) : undefined;
};

// Google's 429 body includes a RetryInfo entry like {"retryDelay":"24s"} -
// either as err.errorDetails (structured, when the SDK parses it) or only
// inline in err.message (what we've actually observed from this SDK
// version). Read both so we back off for as long as Google actually asked,
// instead of guessing with fixed exponential backoff.
const extractRetryDelayMs = (err) => {
  const fromDetails = Array.isArray(err.errorDetails)
    ? err.errorDetails.find((d) => d['@type'] && d['@type'].includes('RetryInfo'))
    : undefined;
  const raw = fromDetails?.retryDelay || (err.message || '').match(/"retryDelay":"([\d.]+)s"/)?.[1] + 's';
  const match = /^([\d.]+)s$/.exec(raw || '');
  return match ? Math.round(parseFloat(match[1]) * 1000) : undefined;
};

// Google's 429 quota-violation body names which quota was hit via
// "quotaId":"...PerDay..." vs "...PerMinute.../PerProjectPerModel...". This
// matters: a per-minute 429 is worth one patient retry, but a per-DAY 429
// (we've seen limits as low as 20/day on the free tier for some models)
// will not clear up for hours - it resets once a day. Retrying that just
// burns more of an already-exhausted daily budget for no chance of success.
const isDailyQuotaError = (err) => /PerDay/i.test(err.message || '');
// Google returns 404 when a model name is invalid OR has been withdrawn
// from this key/tier ("no longer available to new users") - either way,
// retrying the same model name can never succeed; only a different model
// name can.
const isModelUnavailableError = (err, status) => status === 404;

// Once we've seen a daily-quota 429 for a given model, don't even attempt
// another live call to it until the quota should have reset - every attempt
// in between is a wasted request (and on a 20/day budget, wasted requests
// are expensive). Free-tier daily quotas reset around midnight Pacific time;
// PACIFIC_UTC_OFFSET_HOURS assumes PDT (UTC-7) and can be off by an hour
// during PST (Nov-Mar), an acceptable margin for a soft cooldown like this.
const PACIFIC_UTC_OFFSET_HOURS = 7;
const nextPacificMidnightMs = () => {
  const shifted = new Date(Date.now() - PACIFIC_UTC_OFFSET_HOURS * 3600 * 1000);
  const nextMidnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1, 0, 0, 0);
  return nextMidnightShifted + PACIFIC_UTC_OFFSET_HOURS * 3600 * 1000;
};
const dailyQuotaExhaustedUntil = new Map(); // model name -> timestamp ms
const DAILY_QUOTA_MESSAGE = "Today's free-tier Gemini request quota is used up on every configured model (resets daily, roughly at midnight Pacific time). Add another model to GEMINI_MODEL, or wait for the reset.";

/**
 * Builds an ordered list of { name, model } from a comma-separated
 * GEMINI_MODEL env var (a single value still works fine - it's just a
 * one-item list). generateWithRetry walks this list in order, falling
 * forward to the next entry when the current one is unavailable (404),
 * has exhausted its daily quota (429/PerDay), or keeps failing transiently
 * after its own retries - so one bad/exhausted/withdrawn model doesn't take
 * the whole feature down.
 *
 * @param {import('@google/generative-ai').GoogleGenerativeAI} genAI
 * @param {object} [generationConfig]
 */
const buildModelChain = (genAI, generationConfig) => {
  const names = (process.env.GEMINI_MODEL || 'gemini-flash-latest')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return names.map((name) => ({
    name,
    model: genAI.getGenerativeModel(generationConfig ? { model: name, generationConfig } : { model: name }),
  }));
};

// Maps the last error seen after every model in the chain failed onto the
// user-facing ApiError (or rethrows the original for unrecognised failures).
const buildFinalError = (lastErr) => {
  if (lastErr instanceof ApiError) return lastErr;
  const status = extractStatus(lastErr || {});
  if (status === 429) {
    return new ApiError(429, 'The AI service is rate-limited right now (a per-minute quota was exceeded on every configured model). Please wait about a minute and try again.');
  }
  if (!status || status >= 500) {
    return new ApiError(503, 'The AI service is temporarily unavailable right now across every configured model. Please try again in a moment.');
  }
  return lastErr;
};

/**
 * Calls model.generateContent(prompt) across an ordered chain of models
 * (from buildModelChain), with:
 *  - per-model rate limiting so we don't self-inflict 429s under concurrent load
 *  - automatic fallback to the next configured model on a withdrawn/invalid
 *    model (404), an exhausted daily quota (429/PerDay), or repeated
 *    transient failures (5xx/network) on the current one
 *  - a single retry for a per-minute 429, waiting however long Google's
 *    RetryInfo said to (capped, so one request can't hang for a full minute)
 *  - logging of safety blocks / non-STOP finish reasons, so a truncated or
 *    blocked response is diagnosable instead of just failing JSON.parse
 *    downstream with no context
 *
 * @param {{ name: string, model: import('@google/generative-ai').GenerativeModel }[]} chain
 * @param {string} prompt
 * @param {{ maxRetries?: number }} [opts] retries attempted on EACH model before falling forward
 * @returns {Promise<string>} the raw response text
 */
const generateWithRetry = async (chain, prompt, { maxRetries = 1 } = {}) => {
  if (!chain.length) throw new Error('No Gemini model configured (GEMINI_MODEL is empty).');

  let lastErr;

  for (let modelIndex = 0; modelIndex < chain.length; modelIndex += 1) {
    const { name, model } = chain[modelIndex];
    const hasFallback = modelIndex < chain.length - 1;
    const fallbackNote = hasFallback ? ', falling back to the next configured model' : '';

    if (Date.now() < (dailyQuotaExhaustedUntil.get(name) || 0)) {
      lastErr = new ApiError(429, DAILY_QUOTA_MESSAGE);
      continue;
    }

    let usedRateLimitRetry = false;
    let brokeToNextModel = false;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await limiterFor(name).acquire();

      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;

        const blockReason = response.promptFeedback && response.promptFeedback.blockReason;
        if (blockReason) {
          const blockedErr = new Error(`Gemini blocked the request before generating a response (reason: ${blockReason}).`);
          blockedErr.name = 'GeminiSafetyBlock';
          throw blockedErr;
        }

        const text = response.text();
        const candidate = response.candidates && response.candidates[0];
        const finishReason = candidate && candidate.finishReason;

        if (finishReason && finishReason !== 'STOP') {
          // e.g. MAX_TOKENS (truncated output -> invalid JSON downstream) or
          // SAFETY/RECITATION (blocked mid-generation). Logged so a JSON
          // parse failure right after this in the caller can be traced back.
          logger.warn(`Gemini response from "${name}" finished with reason "${finishReason}" instead of STOP`, {
            finishReason,
            textLength: text.length,
            textPreview: text.slice(0, 300),
          });
        }

        return text;
      } catch (err) {
        lastErr = err;
        const status = extractStatus(err);
        const isRateLimit = status === 429;

        if (isRateLimit && isDailyQuotaError(err)) {
          dailyQuotaExhaustedUntil.set(name, nextPacificMidnightMs());
          logger.error(`Gemini daily free-tier quota exhausted for "${name}"${fallbackNote}`, {
            message: err.message,
            resetsAt: new Date(dailyQuotaExhaustedUntil.get(name)).toISOString(),
          });
          brokeToNextModel = true;
          break;
        }

        if (isModelUnavailableError(err, status)) {
          logger.error(`Gemini model "${name}" is unavailable (404)${fallbackNote}`, { message: err.message });
          brokeToNextModel = true;
          break;
        }

        const isRetryable = RETRYABLE_STATUS.has(status) || RETRYABLE_MESSAGE.test(err.message || '');
        const exhaustedOnThisModel = isRateLimit ? usedRateLimitRetry : attempt === maxRetries;

        if (!isRetryable || exhaustedOnThisModel) {
          logger.error(`Gemini call to "${name}" failed after ${attempt + 1} attempt(s)${fallbackNote}`, {
            message: err.message,
            name: err.name,
            status,
          });
          brokeToNextModel = true;
          break;
        }

        let backoffMs;
        if (isRateLimit) {
          usedRateLimitRetry = true;
          backoffMs = Math.min(extractRetryDelayMs(err) || 5000, 20_000);
        } else {
          backoffMs = Math.round(1000 * 2 ** attempt + Math.random() * 300);
        }

        logger.warn(`Gemini call to "${name}" failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms`, {
          message: err.message,
          status,
        });
        await sleep(backoffMs);
      }
    }

    if (!brokeToNextModel) break; // shouldn't happen, but avoid an infinite loop
  }

  // Every model in the chain failed.
  throw buildFinalError(lastErr);
};

/**
 * Streaming counterpart of generateWithRetry: calls onChunk(text) for each
 * piece of the response as it arrives and resolves with the full text.
 *
 * Fallback rules differ slightly, because a stream can't be "un-sent": while
 * NOTHING has been emitted yet, failures fall through to the next model in the
 * chain exactly like generateWithRetry (with one patient retry for a
 * per-minute 429). Once the first chunk has gone out, a failure is thrown
 * as-is - switching models mid-answer would splice two different responses.
 *
 * @param {{ name: string, model: import('@google/generative-ai').GenerativeModel }[]} chain
 * @param {string} prompt
 * @param {(text: string) => void} onChunk
 * @returns {Promise<string>} the full response text
 */
const streamWithFallback = async (chain, prompt, onChunk) => {
  if (!chain.length) throw new Error('No Gemini model configured (GEMINI_MODEL is empty).');

  let lastErr;

  for (const { name, model } of chain) {
    if (Date.now() < (dailyQuotaExhaustedUntil.get(name) || 0)) {
      lastErr = new ApiError(429, DAILY_QUOTA_MESSAGE);
      continue;
    }

    let usedRateLimitRetry = false;
    let emitted = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await limiterFor(name).acquire();

      try {
        const result = await model.generateContentStream(prompt);
        let full = '';
        for await (const chunk of result.stream) {
          const piece = chunk.text();
          if (!piece) continue;
          emitted = true;
          full += piece;
          onChunk(piece);
        }
        return full;
      } catch (err) {
        if (emitted) throw err; // mid-stream failure: cannot switch models now.
        lastErr = err;
        const status = extractStatus(err);

        if (status === 429 && isDailyQuotaError(err)) {
          dailyQuotaExhaustedUntil.set(name, nextPacificMidnightMs());
          logger.error(`Gemini daily free-tier quota exhausted for "${name}" (stream)`, { message: err.message });
          break;
        }
        if (isModelUnavailableError(err, status)) {
          logger.error(`Gemini model "${name}" is unavailable (404) (stream)`, { message: err.message });
          break;
        }

        const retryable = RETRYABLE_STATUS.has(status) || RETRYABLE_MESSAGE.test(err.message || '');
        const canRetry = attempt === 0 && (status === 429 ? !usedRateLimitRetry : true);
        if (!retryable || !canRetry) {
          logger.error(`Gemini stream from "${name}" failed`, { message: err.message, name: err.name, status });
          break;
        }

        if (status === 429) usedRateLimitRetry = true;
        const backoffMs = status === 429
          ? Math.min(extractRetryDelayMs(err) || 5000, 20_000)
          : Math.round(1000 + Math.random() * 300);
        logger.warn(`Gemini stream from "${name}" failed, retrying in ${backoffMs}ms`, { message: err.message, status });
        await sleep(backoffMs);
      }
    }
  }

  throw buildFinalError(lastErr);
};

module.exports = { buildModelChain, generateWithRetry, streamWithFallback };

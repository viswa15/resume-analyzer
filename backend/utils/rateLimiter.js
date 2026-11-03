// backend/utils/rateLimiter.js
// A simple rolling-window rate limiter. Used to keep our own outbound Gemini
// calls under whatever requests-per-minute quota the API key/model actually
// has, instead of firing them all at once and letting every extra call
// bounce off a 429 (which, on the free tier, also burns retries against the
// same limited quota).

/**
 * @param {number} maxPerWindow - max calls allowed inside the rolling window
 * @param {number} windowMs - window size in ms (e.g. 60_000 for "per minute")
 */
const createRateLimiter = (maxPerWindow, windowMs) => {
  const timestamps = []; // start times of calls still inside the window

  const prune = () => {
    const cutoff = Date.now() - windowMs;
    while (timestamps.length && timestamps[0] <= cutoff) {
      timestamps.shift();
    }
  };

  /**
   * Resolves once a slot is available, then reserves it immediately
   * (so concurrent callers don't all see the same "1 free slot").
   */
  const acquire = async () => {
    for (;;) {
      prune();
      if (timestamps.length < maxPerWindow) {
        timestamps.push(Date.now());
        return;
      }
      const waitMs = Math.max(timestamps[0] + windowMs - Date.now(), 50);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  };

  return { acquire };
};

module.exports = { createRateLimiter };

// backend/tests/geminiStream.test.js
const { streamWithFallback } = require('../utils/geminiClient');

const streamOf = (pieces, failAfter) => ({
  stream: (async function* generate() {
    for (let i = 0; i < pieces.length; i += 1) {
      if (failAfter !== undefined && i === failAfter) throw Object.assign(new Error('boom mid-stream'), { status: 500 });
      yield { text: () => pieces[i] };
    }
  })(),
});

const statusError = (status, message = `[${status} Error]`) => Object.assign(new Error(message), { status });
// Distinct model names per test: the client keeps per-model rate limiters and quota cooldowns.
let n = 0;
const entry = (generateContentStream) => ({ name: `stream-test-model-${(n += 1)}`, model: { generateContentStream } });

describe('streamWithFallback', () => {
  it('emits chunks in order and resolves with the full text', async () => {
    const seen = [];
    const chain = [entry(jest.fn().mockResolvedValue(streamOf(['Hel', 'lo', ''])))];
    const text = await streamWithFallback(chain, 'p', (c) => seen.push(c));
    expect(seen).toEqual(['Hel', 'lo']);
    expect(text).toBe('Hello');
  });

  it('falls forward to the next model when the first is unavailable (404)', async () => {
    const first = jest.fn().mockRejectedValue(statusError(404));
    const second = jest.fn().mockResolvedValue(streamOf(['ok']));
    const text = await streamWithFallback([entry(first), entry(second)], 'p', () => {});
    expect(text).toBe('ok');
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('skips a model whose daily quota is exhausted and remembers it', async () => {
    const exhausted = entry(jest.fn().mockRejectedValue(statusError(429, '[429] quotaId: GenerateRequestsPerDayPerProjectPerModel')));
    const backup = entry(jest.fn().mockResolvedValue(streamOf(['fine'])));
    await streamWithFallback([exhausted, backup], 'p', () => {});
    await streamWithFallback([exhausted, backup], 'p', () => {});
    expect(exhausted.model.generateContentStream).toHaveBeenCalledTimes(1); // second call skipped by cooldown
    expect(backup.model.generateContentStream).toHaveBeenCalledTimes(2);
  });

  it('does NOT switch models once output has started', async () => {
    const seen = [];
    const first = jest.fn().mockResolvedValue(streamOf(['part one', 'part two'], 1));
    const second = jest.fn().mockResolvedValue(streamOf(['other model']));
    await expect(streamWithFallback([entry(first), entry(second)], 'p', (c) => seen.push(c))).rejects.toThrow('boom mid-stream');
    expect(seen).toEqual(['part one']);
    expect(second).not.toHaveBeenCalled();
  });

  it('retries a transient failure once on the same model', async () => {
    const flaky = jest.fn().mockRejectedValueOnce(statusError(503)).mockResolvedValueOnce(streamOf(['recovered']));
    const text = await streamWithFallback([entry(flaky)], 'p', () => {});
    expect(text).toBe('recovered');
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it('maps persistent server failure on every model to a friendly 503', async () => {
    const chain = [entry(jest.fn().mockRejectedValue(statusError(503)))];
    await expect(streamWithFallback(chain, 'p', () => {})).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/temporarily unavailable/),
    });
  });

  it('rethrows unrecognised client errors unchanged when no model can serve them', async () => {
    const original = statusError(404, 'model gone');
    const chain = [entry(jest.fn().mockRejectedValue(original))];
    await expect(streamWithFallback(chain, 'p', () => {})).rejects.toBe(original);
  });

  it('rejects an empty chain', async () => {
    await expect(streamWithFallback([], 'p', () => {})).rejects.toThrow(/No Gemini model configured/);
  });
});

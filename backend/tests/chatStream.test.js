// backend/tests/chatStream.test.js
jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../services/chatService', () => ({
  answerQuestionAboutResume: jest.fn(),
  streamAnswerAboutResume: jest.fn(),
}));

const request = require('supertest');
const db = require('../db');
const { streamAnswerAboutResume } = require('../services/chatService');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const app = require('../app');

const authHeader = () => `Bearer ${signToken({ sub: 1, email: 'a@b.com' })}`;
const post = () => request(app).post('/api/resumes/4/chat/stream').set('Authorization', authHeader());

describe('POST /api/resumes/:id/chat/stream', () => {
  it('requires auth', async () => {
    expect((await request(app).post('/api/resumes/4/chat/stream').send({ question: 'hi' })).status).toBe(401);
  });

  it('rejects an empty question before opening a stream', async () => {
    const res = await post().send({ question: '' });
    expect(res.status).toBe(400);
  });

  it('returns a normal JSON 404 for a resume the caller does not own', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await post().send({ question: 'hi' });
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('streams deltas, then a done event, and saves the exchange', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 4, resume_text: 'resume text' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    streamAnswerAboutResume.mockImplementation(async (_text, _q, _history, onChunk) => {
      onChunk('Hello ');
      onChunk('world');
      return 'Hello world';
    });

    const res = await post().send({ question: 'Summarise this candidate' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.text).toContain('data: {"delta":"Hello "}');
    expect(res.text).toContain('data: {"delta":"world"}');
    expect(res.text).toContain('event: done\ndata: {"answer":"Hello world"}');
    const insert = db.query.mock.calls[2];
    expect(insert[0]).toMatch(/INSERT INTO chat_messages/);
    expect(insert[1]).toEqual(['4', 1, 'Summarise this candidate', 'Hello world']);
  });

  it('sends an error event and saves nothing when the model fails', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 4, resume_text: 'r' }] }).mockResolvedValueOnce({ rows: [] });
    streamAnswerAboutResume.mockRejectedValue(new ApiError(429, 'The AI service is rate-limited right now.'));

    const res = await post().send({ question: 'hi' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('event: error');
    expect(res.text).toContain('rate-limited');
    expect(db.query).toHaveBeenCalledTimes(2); // ownership + history only, no INSERT
  });

  it('hides unexpected internal error details from the client', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 4, resume_text: 'r' }] }).mockResolvedValueOnce({ rows: [] });
    streamAnswerAboutResume.mockRejectedValue(new Error('socket hang up at 10.0.0.5'));

    const res = await post().send({ question: 'hi' });

    expect(res.text).toContain('event: error');
    expect(res.text).not.toContain('10.0.0.5');
  });
});

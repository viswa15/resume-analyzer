-- 005_match_history.sql
-- Persists every JD match result so score trends and recurring skill gaps can be
-- charted over time (see controllers/insightsController.js).
CREATE TABLE IF NOT EXISTS match_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL,
    job_snippet VARCHAR(160),
    missing_keywords JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_match_history_user_id ON match_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_match_history_resume_id ON match_history(resume_id);

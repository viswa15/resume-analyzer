-- 002_auth_and_ownership.sql
-- Adds real user accounts and scopes resumes to their owner.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_text TEXT;

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

-- 004_applications.sql
-- Adds a lightweight job-application tracker, scoped to its owning user and
-- optionally linked back to the resume that was used for that application.
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
    company VARCHAR(255) NOT NULL,
    role_title VARCHAR(255) NOT NULL,
    job_url VARCHAR(1000),
    status VARCHAR(30) NOT NULL DEFAULT 'saved'
        CHECK (status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
    notes TEXT,
    applied_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

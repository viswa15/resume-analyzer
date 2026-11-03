// backend/controllers/insightsController.js
//
// Read-only aggregates for the Insights page: resume rating history, JD match
// score history, the skills a user is most often missing, and an application
// funnel. Everything here is plain SQL/JS - no LLM calls.
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');

const STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/**
 * Counts how often each keyword appears across a set of match_history rows
 * and returns the top N, most frequent first (ties broken alphabetically).
 */
const topMissingKeywords = (rows, limit = 8) => {
  const counts = new Map();
  for (const row of rows) {
    const list = Array.isArray(row.missing_keywords) ? row.missing_keywords : [];
    for (const keyword of new Set(list.filter((k) => typeof k === 'string' && k.trim()))) {
      const key = keyword.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
};

/**
 * Builds the application funnel. "Submitted" means anything that has moved past
 * the "saved" stage; rates are relative to that, or null when nothing has been
 * submitted yet (so the UI can show "no data" rather than a misleading 0%).
 */
const buildFunnel = (statusRows) => {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of statusRows) {
    if (row.status in byStatus) byStatus[row.status] = Number(row.count) || 0;
  }
  const total = STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
  const submitted = total - byStatus.saved;
  const interviewed = byStatus.interviewing + byStatus.offer;
  return {
    byStatus,
    total,
    submitted,
    responseRate: percent(interviewed + byStatus.rejected, submitted),
    interviewRate: percent(interviewed, submitted),
    offerRate: percent(byStatus.offer, submitted),
  };
};

const getInsights = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [ratings, matches, statuses, weekly] = await Promise.all([
    db.query(
      `SELECT id, file_name, uploaded_at, resume_rating
       FROM resumes WHERE user_id = $1 AND resume_rating IS NOT NULL
       ORDER BY uploaded_at ASC LIMIT 50;`,
      [userId]
    ),
    db.query(
      `SELECT m.id, m.resume_id, r.file_name, m.match_score, m.job_snippet, m.missing_keywords, m.created_at
       FROM match_history m JOIN resumes r ON r.id = m.resume_id
       WHERE m.user_id = $1
       ORDER BY m.created_at ASC LIMIT 100;`,
      [userId]
    ),
    db.query('SELECT status, COUNT(*)::int AS count FROM applications WHERE user_id = $1 GROUP BY status;', [userId]),
    db.query(
      `SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week, COUNT(*)::int AS count
       FROM applications
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '8 weeks'
       GROUP BY 1 ORDER BY 1 ASC;`,
      [userId]
    ),
  ]);

  const matchRows = matches.rows;
  res.status(200).json({
    resumeRatings: ratings.rows,
    matchHistory: matchRows.map(({ missing_keywords, ...rest }) => rest),
    topMissingKeywords: topMissingKeywords(matchRows),
    applications: { ...buildFunnel(statuses.rows), weekly: weekly.rows },
  });
});

module.exports = { getInsights, topMissingKeywords, buildFunnel };

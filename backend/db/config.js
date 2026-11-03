// backend/db/config.js
// Shared pg Pool configuration, used by both db/index.js (the app) and
// db/migrate.js (the migration runner) so they never drift apart.
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// SSL is opt-in via DB_SSL=true, independent of NODE_ENV: managed providers
// like Render need it, but a plain local Postgres instance usually doesn't
// speak SSL at all.
const sslEnabled = process.env.DB_SSL === 'true';

const buildPoolConfig = () => {
  // TCP keepalive stops connections from going silent-idle long enough for
  // the OS/a firewall to kill them without either side noticing - the main
  // real-world cause of the sporadic ECONNRESET errors seen from pg-pool on
  // local (esp. Windows) Postgres setups. idleTimeoutMillis also recycles
  // pooled connections proactively instead of letting them sit indefinitely.
  const resilience = {
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    idleTimeoutMillis: 30000,
  };

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
      ...resilience,
    };
  }

  return {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    ...resilience,
  };
};

module.exports = { buildPoolConfig, isProduction };

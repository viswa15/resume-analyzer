// backend/db/index.js
const { Pool } = require('pg');
const { buildPoolConfig } = require('./config');
const logger = require('../utils/logger');

const pool = new Pool(buildPoolConfig());

// node-postgres emits 'error' on the Pool whenever an *idle* pooled client
// hits a network-level problem (e.g. the OS or a firewall silently killing
// a long-idle TCP connection - very common on local Windows/Postgres setups
// and shows up as ECONNRESET). If nothing listens for this event, Node
// treats it as an unhandled error and crashes the whole process - every
// in-flight and future request would fail, which looks exactly like "the
// app stopped responding" from the frontend. Logging and swallowing it here
// lets the pool quietly drop the dead connection and open a fresh one on
// the next query instead of taking the server down.
pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', {
    message: err.message,
    stack: err.stack,
  });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

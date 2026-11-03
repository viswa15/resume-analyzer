// backend/server.js
const app = require('./app');
const { assertEnv, port } = require('./config/env');
const logger = require('./utils/logger');

try {
  assertEnv();
} catch (err) {
  logger.error(err.message);
  process.exit(1);
}

app.listen(port, () => {
  logger.info(`🚀 Server is running on http://localhost:${port}`);
});

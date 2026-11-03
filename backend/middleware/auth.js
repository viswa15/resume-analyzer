// backend/middleware/auth.js
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header.'));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
};

module.exports = requireAuth;

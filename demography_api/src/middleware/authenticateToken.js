const jwt = require('jsonwebtoken');

/**
 * Verifies the httpOnly `token` cookie set by POST /api/register or
 * POST /api/login and attaches { id, username } to req.user.
 *
 * Everything downstream (withUserConnection, the stored procedures, the
 * ownership triggers) trusts req.user.id completely and has no auth
 * logic of its own, by design -- this is the one place auth happens.
 */
function authenticateToken(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'not authenticated' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'invalid or expired session' });
    }
    req.user = { id: payload.id, username: payload.username };
    next();
  });
}

module.exports = authenticateToken;

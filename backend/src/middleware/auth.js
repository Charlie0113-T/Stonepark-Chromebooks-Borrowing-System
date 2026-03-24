/**
 * JWT authentication middleware and Google OAuth helpers.
 *
 * Configuration via environment variables:
 *   JWT_SECRET            – secret for signing JWTs (required in production)
 *   GOOGLE_CLIENT_ID      – Google OAuth 2.0 client ID
 *   GOOGLE_CLIENT_SECRET  – Google OAuth 2.0 client secret
 *   GOOGLE_CALLBACK_URL   – OAuth callback URL (e.g. http://localhost:4000/api/auth/google/callback)
 *   AUTH_BYPASS           – set to 'true' to skip auth in development
 *
 * When AUTH_BYPASS=true (or JWT_SECRET is not set), all requests are treated
 * as authenticated as a default admin user – useful during local development.
 */

const jwt = require('jsonwebtoken');

const AUTH_BYPASS = process.env.AUTH_BYPASS === 'true' || !process.env.JWT_SECRET;

if (!process.env.JWT_SECRET && !AUTH_BYPASS) {
  // Throw at startup so the misconfiguration is caught immediately.
  throw new Error('JWT_SECRET environment variable is required when AUTH_BYPASS is not true. Set it in your .env file.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const DEFAULT_DEV_USER = {
  id: 'dev-user',
  email: 'admin@stonepark.school.nz',
  name: 'Dev Admin',
  role: 'admin',
  schoolId: 'school-default',
};

const { whitelistDB } = require('../db/database');

async function isAllowedEmail(email) {
  return whitelistDB.isWhitelisted(email);
}

/**
 * Signs a JWT for the given user payload.
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * Verifies a JWT and returns the decoded payload, or null if invalid.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Express middleware: authenticates the request via Bearer JWT.
 * In bypass mode (development), attaches DEFAULT_DEV_USER and continues.
 */
function requireAuth(req, res, next) {
  if (AUTH_BYPASS) {
    req.user = DEFAULT_DEV_USER;
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  req.user = payload;
  next();
}

/**
 * Express middleware: requires admin role.
 * Must be used after requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin role required.' });
  }
  next();
}

/**
 * Express middleware: requires the authenticated user to be on the email whitelist.
 * Must be used after requireAuth.
 */
async function requireWhitelisted(req, res, next) {
  if (AUTH_BYPASS) return next();
  if (!req.user || !(await isAllowedEmail(req.user.email))) {
    return res.status(403).json({ success: false, message: 'This account is not on the whitelist.' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireWhitelisted,
  signToken,
  verifyToken,
  isAllowedEmail,
  AUTH_BYPASS,
  DEFAULT_DEV_USER,
};

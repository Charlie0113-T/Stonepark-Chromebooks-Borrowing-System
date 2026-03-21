/**
 * Authentication routes
 * GET  /api/auth/me            - get current user (requires auth)
 * POST /api/auth/login         - mock/dev login (returns JWT)
 * GET  /api/auth/google        - redirect to Google OAuth
 * GET  /api/auth/google/callback - Google OAuth callback
 * POST /api/auth/logout        - logout (client-side; JWT is stateless)
 *
 * Google OAuth requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('node:crypto');
const { signToken, requireAuth, AUTH_BYPASS } = require('../middleware/auth');
const { schoolsDB } = require('../db/database');

const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || '@cloud.edu.pe.ca').trim().toLowerCase();

function isAllowedEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

// 20 login attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

// 60 general auth requests per 15 minutes per IP
const authApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

module.exports = function createAuthRouter() {
  const router = express.Router();

  // Apply general rate limit to all auth endpoints
  router.use(authApiLimiter);

  // GET /api/auth/me
  router.get('/me', requireAuth, (req, res) => {
    res.json({ success: true, data: req.user });
  });

  // POST /api/auth/login  – dev/staff login with email (no password in dev mode)
  // In production, replace with proper credential validation or Google OAuth.
  router.post('/login', authLimiter, (req, res) => {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required.' });
    }
    if (!isAllowedEmail(email)) {
      return res.status(403).json({ success: false, message: `Only ${ALLOWED_EMAIL_DOMAIN} accounts are allowed.` });
    }

    const user = {
      id: randomUUID(),
      email,
      name: name || email.split('@')[0],
      role: 'staff',
      schoolId: 'school-default',
    };
    const token = signToken(user);
    res.json({ success: true, data: { user, token } });
  });

  // GET /api/auth/google – redirect to Google OAuth
  // This route is only active when GOOGLE_CLIENT_ID is configured.
  router.get('/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(501).json({
        success: false,
        message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      });
    }
    const callbackUrl = encodeURIComponent(
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback'
    );
    const scope = encodeURIComponent('openid email profile');
    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&scope=${scope}&access_type=offline`
    );
  });

  // GET /api/auth/google/callback – Google OAuth callback
  router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing OAuth code.' });
    }

    try {
      const https = require('https');
      const querystring = require('querystring');

      const tokenBody = querystring.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
        grant_type: 'authorization_code',
      });

      // Exchange code for tokens
      const tokenData = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody) },
          },
          (resp) => {
            let data = '';
            resp.on('data', (chunk) => (data += chunk));
            resp.on('end', () => resolve(JSON.parse(data)));
          }
        );
        req.on('error', reject);
        req.write(tokenBody);
        req.end();
      });

      if (tokenData.error) {
        return res.status(401).json({ success: false, message: tokenData.error_description || 'OAuth failed.' });
      }

      // Decode id_token (JWT) – we trust Google's signature here (simplified)
      const idToken = tokenData.id_token;
      const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
      if (!isAllowedEmail(payload.email)) {
        return res.status(403).json({ success: false, message: `Only ${ALLOWED_EMAIL_DOMAIN} accounts are allowed.` });
      }

      const user = {
        id: `google-${payload.sub}`,
        email: payload.email,
        name: payload.name,
        role: 'staff',
        schoolId: 'school-default',
        googleId: payload.sub,
      };
      const token = signToken(user);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}?token=${token}`);
    } catch (err) {
      console.error('[Auth] Google OAuth callback error:', err);
      res.status(500).json({ success: false, message: 'OAuth callback failed.' });
    }
  });

  // POST /api/auth/logout – JWT is stateless; client should discard the token
  router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out. Please discard your token.' });
  });

  // GET /api/auth/status – quick check of auth configuration
  router.get('/status', (req, res) => {
    res.json({
      success: true,
      data: {
        bypassEnabled: AUTH_BYPASS,
        googleOAuthConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        smtpConfigured: !!process.env.SMTP_HOST,
        googleChatConfigured: !!process.env.GOOGLE_CHAT_WEBHOOK_URL,
      },
    });
  });

  return router;
};

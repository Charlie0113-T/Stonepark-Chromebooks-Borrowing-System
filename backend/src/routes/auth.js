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
const bcrypt = require('bcryptjs');
const { signToken, requireAuth, AUTH_BYPASS } = require('../middleware/auth');
const { usersDB } = require('../db/database');
const { sendEmail } = require('../services/notifications');

const DEFAULT_ALLOWED_EMAILS = ['chta0655@cloud.edu.pe.ca', 'dmdunn@cloud.edu.pe.ca'];

function getAllowedEmails() {
  const raw = (process.env.ALLOWED_EMAILS || '').trim();
  const list = raw
    ? raw.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ALLOWED_EMAILS;
  return new Set(list);
}

function isAllowedEmail(email) {
  if (!email) return false;
  return getAllowedEmails().has(email.toLowerCase());
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

  // POST /api/auth/login – password-based login
  router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required.' });
    }
    if (!isAllowedEmail(email)) {
      return res.status(403).json({ success: false, message: 'This email is not on the whitelist.' });
    }

    const user = await usersDB.verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.school_id || 'school-default',
    });
    res.json({ success: true, data: { user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.school_id || 'school-default',
    }, token } });
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
        return res.status(403).json({ success: false, message: 'This email is not on the whitelist.' });
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

  // POST /api/auth/forgot-password – request reset token
  router.post('/forgot-password', authLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required.' });
    }
    if (!isAllowedEmail(email)) {
      return res.status(403).json({ success: false, message: 'This email is not on the whitelist.' });
    }

    const user = await usersDB.getByEmail(email);
    if (user) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await usersDB.setResetToken(email, token, expiresAt);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const body = [
        'You requested a password reset for Stonepark Chromebook Manager.',
        '',
        `Reset code: ${token}`,
        `Reset page: ${frontendUrl}`,
        '',
        'If you did not request this, please ignore this email.',
      ].join('\n');

      await sendEmail({
        to: email,
        subject: 'Password reset request',
        text: body,
      });
    }

    res.json({ success: true, message: 'If the email exists, a reset code was sent.' });
  });

  // POST /api/auth/reset-password – reset using token
  router.post('/reset-password', authLimiter, async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'token and newPassword are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const user = await usersDB.resetPassword(token, hash);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    }

    res.json({ success: true, message: 'Password reset successful.' });
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
        allowedEmails: Array.from(getAllowedEmails()),
      },
    });
  });

  return router;
};

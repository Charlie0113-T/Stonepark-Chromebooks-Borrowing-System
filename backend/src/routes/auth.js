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

const express = require("express");
const rateLimit = require("express-rate-limit");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const {
  signToken,
  requireAuth,
  requireAdmin,
  requireWhitelisted,
  AUTH_BYPASS,
  isAllowedEmail,
} = require("../middleware/auth");
const {
  usersDB,
  whitelistDB,
  whitelistRemovalDB,
  whitelistRequestsDB,
} = require("../db/database");

// ── Admin user management helpers ─────────────────────────────────────────────
function getStaffSeedEmails() {
  const raw = (process.env.STAFF_USERS || "").trim();
  if (!raw) return new Set();
  const emails = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(":");
      return parts.length >= 3 ? parts[1] : parts[0];
    })
    .map((email) => (email || "").trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}
const { sendEmail } = require("../services/notifications");

function getAdminSeedEmails() {
  const raw = (process.env.ADMIN_USERS || "").trim();
  if (!raw) return new Set();
  const emails = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(":")[0])
    .map((email) => (email || "").trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

async function getWhitelistedAdmins() {
  const admins = await usersDB.getAdmins();
  const results = [];
  for (const admin of admins) {
    if (await whitelistDB.isWhitelisted(admin.email)) {
      results.push(admin);
    }
  }
  return results;
}

// 20 login attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

// 60 general auth requests per 15 minutes per IP
const authApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

module.exports = function createAuthRouter() {
  const router = express.Router();

  // Apply general rate limit to all auth endpoints
  router.use(authApiLimiter);

  // GET /api/auth/me
  router.get("/me", requireAuth, (req, res) => {
    res.json({ success: true, data: req.user });
  });

  // POST /api/auth/signup – create account (whitelist only)
  router.post("/signup", authLimiter, async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "email and password are required." });
    }
    if (!(await isAllowedEmail(email))) {
      return res.status(403).json({
        success: false,
        message: "This email is not on the whitelist.",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const existing = await usersDB.getByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Account already exists. Please sign in.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = name && name.trim() ? name.trim() : email.split("@")[0];
    const adminSeedEmails = getAdminSeedEmails();
    const normalizedEmail = email.toLowerCase();
    const role = adminSeedEmails.has(normalizedEmail) ? "admin" : "staff";
    const user = await usersDB.createUser({
      email,
      name: displayName,
      role,
      passwordHash,
    });

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: role,
      schoolId: user.school_id || "school-default",
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          schoolId: user.school_id || "school-default",
        },
        token,
      },
    });
  });

  // POST /api/auth/login – password-based login
  router.post("/login", authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "email and password are required." });
    }
    if (!(await isAllowedEmail(email))) {
      return res.status(403).json({
        success: false,
        message: "This email is not on the whitelist.",
      });
    }

    const existing = await usersDB.getByEmail(email);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "Email is whitelisted, but no account exists yet. Please use Sign Up first.",
      });
    }

    const user = await usersDB.verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please try again or reset password.",
      });
    }

    const adminSeedEmails = getAdminSeedEmails();
    let role = user.role;
    if (adminSeedEmails.has(user.email.toLowerCase())) {
      role = "admin";
      if (user.role !== "admin") {
        await usersDB.setRole(user.email, "admin");
      }
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      schoolId: user.school_id || "school-default",
    });
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          schoolId: user.school_id || "school-default",
        },
        token,
      },
    });
  });

  // GET /api/auth/google – redirect to Google OAuth
  // This route is only active when GOOGLE_CLIENT_ID is configured.
  router.get("/google", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(501).json({
        success: false,
        message:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      });
    }
    const callbackUrl = encodeURIComponent(
      process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:4000/api/auth/google/callback",
    );
    const scope = encodeURIComponent("openid email profile");
    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&scope=${scope}&access_type=offline`,
    );
  });

  // GET /api/auth/google/callback – Google OAuth callback
  router.get("/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Missing OAuth code." });
    }

    try {
      const https = require("https");
      const querystring = require("querystring");

      const tokenBody = querystring.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:4000/api/auth/google/callback",
        grant_type: "authorization_code",
      });

      // Exchange code for tokens
      const tokenData = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: "oauth2.googleapis.com",
            path: "/token",
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(tokenBody),
            },
          },
          (resp) => {
            let data = "";
            resp.on("data", (chunk) => (data += chunk));
            resp.on("end", () => resolve(JSON.parse(data)));
          },
        );
        req.on("error", reject);
        req.write(tokenBody);
        req.end();
      });

      if (tokenData.error) {
        return res.status(401).json({
          success: false,
          message: tokenData.error_description || "OAuth failed.",
        });
      }

      // Decode id_token (JWT) – we trust Google's signature here (simplified)
      const idToken = tokenData.id_token;
      const payload = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64url").toString(),
      );

      // Basic validation: ensure the token is intended for our application
      if (payload.aud !== clientId) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid token audience." });
      }
      if (!payload.email || !payload.email_verified) {
        return res
          .status(401)
          .json({ success: false, message: "Email not verified by Google." });
      }

      if (!(await isAllowedEmail(payload.email))) {
        return res.status(403).json({
          success: false,
          message: "This email is not on the whitelist.",
        });
      }

      const adminSeedEmails = getAdminSeedEmails();
      const normalizedEmail = payload.email.toLowerCase();
      let role = adminSeedEmails.has(normalizedEmail) ? "admin" : "staff";
      const existing = await usersDB.getByEmail(normalizedEmail);
      if (existing?.role === "admin") {
        role = "admin";
      }

      const storedUser = await usersDB.upsertGoogleUser({
        email: normalizedEmail,
        name: payload.name,
        googleId: payload.sub,
        role,
        schoolId: "school-default",
      });

      const token = signToken({
        id: storedUser?.id || `google-${payload.sub}`,
        email: normalizedEmail,
        name: storedUser?.name || payload.name,
        role,
        schoolId: storedUser?.school_id || "school-default",
      });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}#token=${token}`);
    } catch (err) {
      console.error("[Auth] Google OAuth callback error:", err);
      res
        .status(500)
        .json({ success: false, message: "OAuth callback failed." });
    }
  });

  // POST /api/auth/logout – JWT is stateless; client should discard the token
  router.post("/logout", (req, res) => {
    res.json({
      success: true,
      message: "Logged out. Please discard your token.",
    });
  });

  // POST /api/auth/forgot-password – request reset token
  router.post("/forgot-password", authLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "email is required." });
    }
    if (!process.env.SMTP_HOST) {
      return res.status(503).json({
        success: false,
        message:
          "Password reset email is not configured on the server (SMTP_HOST missing).",
      });
    }
    if (!(await isAllowedEmail(email))) {
      return res.status(403).json({
        success: false,
        message: "This email is not on the whitelist.",
      });
    }

    const user = await usersDB.getByEmail(email);
    if (user) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await usersDB.setResetToken(email, token, expiresAt);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const body = [
        "You requested a password reset for Stonepark Chromebook Manager.",
        "",
        `Reset code: ${token}`,
        `Reset page: ${frontendUrl}`,
        "",
        "If you did not request this, please ignore this email.",
      ].join("\n");

      const result = await sendEmail({
        to: email,
        subject: "Password reset request",
        text: body,
      });
      if (!result || !result.ok) {
        return res.status(502).json({
          success: false,
          message:
            "Password reset email failed to send. Please contact admin to check SMTP settings.",
        });
      }
    }

    res.json({
      success: true,
      message: "If the email exists, a reset code was sent.",
    });
  });

  // POST /api/auth/reset-password – reset using token
  router.post("/reset-password", authLimiter, async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "token and newPassword are required.",
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const user = await usersDB.resetPassword(token, hash);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });
    }

    res.json({ success: true, message: "Password reset successful." });
  });

  // GET /api/auth/status – quick check of auth configuration (public, no sensitive data)
  router.get("/status", async (req, res) => {
    res.json({
      success: true,
      data: {
        googleOAuthConfigured: !!(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
      },
    });
  });

  // ── Whitelist Management (admin only, admin must be whitelisted) ──────────

  router.get(
    "/whitelist",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (_req, res) => {
      const [entries, admins] = await Promise.all([
        whitelistDB.getAll(),
        usersDB.getAdmins(),
      ]);
      const adminSet = new Set(
        admins.map((a) => (a.email || "").toLowerCase()),
      );
      const enriched = entries.map((entry) => ({
        ...entry,
        is_admin: adminSet.has((entry.email || "").toLowerCase()),
      }));
      res.json({ success: true, data: enriched });
    },
  );

  router.post(
    "/whitelist",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "email is required." });
      }
      const entry = await whitelistDB.add(email, req.user.email);
      if (!entry) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid email." });
      }
      res.status(201).json({ success: true, data: entry });
    },
  );

  router.delete(
    "/whitelist",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "email is required." });
      }
      const normalized = email.toLowerCase();
      if (req.user.email.toLowerCase() === normalized) {
        return res
          .status(400)
          .json({ success: false, message: "You cannot remove yourself." });
      }
      const adminList = await getWhitelistedAdmins();
      const isAdminTarget = adminList.some(
        (admin) => admin.email.toLowerCase() === normalized,
      );
      if (isAdminTarget) {
        return res.status(409).json({
          success: false,
          message: "Admin removal requires consensus voting.",
        });
      }
      const removed = await whitelistDB.remove(email);
      if (!removed) {
        return res
          .status(404)
          .json({ success: false, message: "Email not found in whitelist." });
      }
      res.json({ success: true, message: "Whitelist entry removed." });
    },
  );

  // ── Whitelist Admin Removal Votes ───────────────────────────────────────

  router.get(
    "/whitelist/removals",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const requests = await whitelistRemovalDB.getAll();
      const adminList = await getWhitelistedAdmins();
      const adminEmails = adminList.map((admin) => admin.email.toLowerCase());

      const data = [];
      for (const request of requests) {
        const target = (request.email || "").toLowerCase();
        const createdBy = (request.created_by || "").toLowerCase();
        const eligibleVoters = adminEmails.filter(
          (email) => email !== createdBy && email !== target,
        );
        const required = eligibleVoters.length;
        const votes = await whitelistRemovalDB.countVotes(target);
        const hasVoted = await whitelistRemovalDB.hasVoted(
          target,
          req.user.email,
        );
        data.push({
          email: request.email,
          created_by: request.created_by,
          created_at: request.created_at,
          votes,
          required,
          has_voted: hasVoted,
        });
      }

      res.json({ success: true, data });
    },
  );

  router.post(
    "/whitelist/removals",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "email is required." });
      }
      const normalized = email.toLowerCase();
      if (req.user.email.toLowerCase() === normalized) {
        return res
          .status(400)
          .json({ success: false, message: "You cannot remove yourself." });
      }

      const adminList = await getWhitelistedAdmins();
      const adminEmails = adminList.map((admin) => admin.email.toLowerCase());
      if (!adminEmails.includes(normalized)) {
        return res.status(400).json({
          success: false,
          message: "Only admin removal requires voting.",
        });
      }

      const eligibleVoters = adminEmails.filter(
        (adminEmail) =>
          adminEmail !== req.user.email.toLowerCase() &&
          adminEmail !== normalized,
      );
      if (eligibleVoters.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot remove the only admin." });
      }

      const request = await whitelistRemovalDB.createRequest(
        normalized,
        req.user.email,
      );
      const votes = await whitelistRemovalDB.countVotes(normalized);

      res.status(202).json({
        success: true,
        data: {
          email: request.email,
          created_by: request.created_by,
          created_at: request.created_at,
          votes,
          required: eligibleVoters.length,
        },
      });
    },
  );

  router.post(
    "/whitelist/removals/:email/vote",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const targetEmail = (req.params.email || "").toLowerCase();
      if (!targetEmail) {
        return res
          .status(400)
          .json({ success: false, message: "email is required." });
      }

      const request = await whitelistRemovalDB.getByEmail(targetEmail);
      if (!request) {
        return res
          .status(404)
          .json({ success: false, message: "Removal request not found." });
      }

      const adminList = await getWhitelistedAdmins();
      const adminEmails = adminList.map((admin) => admin.email.toLowerCase());
      if (!adminEmails.includes(req.user.email.toLowerCase())) {
        return res.status(403).json({
          success: false,
          message: "Only whitelisted admins can vote.",
        });
      }

      if (req.user.email.toLowerCase() === request.created_by.toLowerCase()) {
        return res
          .status(400)
          .json({ success: false, message: "Requester cannot vote." });
      }

      if (req.user.email.toLowerCase() === targetEmail) {
        return res
          .status(400)
          .json({ success: false, message: "Target cannot vote." });
      }

      await whitelistRemovalDB.addVote(targetEmail, req.user.email);

      const eligibleVoters = adminEmails.filter(
        (adminEmail) =>
          adminEmail !== request.created_by.toLowerCase() &&
          adminEmail !== targetEmail,
      );
      const required = eligibleVoters.length;
      const votes = await whitelistRemovalDB.countVotes(targetEmail);

      if (votes >= required && required > 0) {
        await whitelistDB.remove(targetEmail);
        await whitelistRemovalDB.clearRequest(targetEmail);
        return res.json({
          success: true,
          data: { status: "removed", email: targetEmail },
        });
      }

      res.json({
        success: true,
        data: { status: "pending", email: targetEmail, votes, required },
      });
    },
  );

  // Public: POST /api/auth/whitelist/apply – request to be added to whitelist
  router.post("/whitelist/apply", authLimiter, async (req, res) => {
    const { email, message } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "email is required." });

    // If already whitelisted, short-circuit
    if (await whitelistDB.isWhitelisted(email)) {
      return res
        .status(409)
        .json({ success: false, message: "Email is already whitelisted." });
    }

    const request = await whitelistRequestsDB.createRequest(
      email,
      (req.user && req.user.email) || null,
      message || "",
    );
    if (!request)
      return res
        .status(400)
        .json({ success: false, message: "Invalid request." });

    // Notify admins if SMTP is configured
    try {
      const admins = await getWhitelistedAdmins();
      const adminEmails = admins.map((a) => a.email).filter(Boolean);
      if (adminEmails.length > 0 && process.env.SMTP_HOST) {
        const subject = "Whitelist request received";
        const body = `A new whitelist request was submitted for ${request.email}.\n\nMessage: ${request.message || ""}`;
        for (const to of adminEmails) {
          await sendEmail({ to, subject, text: body });
        }
      }
    } catch (err) {
      console.warn(
        "[Notify] Failed to notify admins about whitelist request:",
        err && err.message,
      );
    }

    res.status(202).json({ success: true, data: request });
  });

  // Admin: list pending whitelist applications
  router.get(
    "/whitelist/applications",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (_req, res) => {
      const requests = await whitelistRequestsDB.getAll();
      res.json({ success: true, data: requests });
    },
  );

  // Admin: approve an application
  router.post(
    "/whitelist/applications/:email/approve",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const target = (req.params.email || "").toLowerCase();
      if (!target)
        return res
          .status(400)
          .json({ success: false, message: "email is required." });

      const existing = await whitelistRequestsDB.getByEmail(target);
      if (!existing)
        return res
          .status(404)
          .json({ success: false, message: "Application not found." });

      const entry = await whitelistDB.add(target, req.user.email);
      await whitelistRequestsDB.removeRequest(target);

      // notify applicant
      try {
        if (process.env.SMTP_HOST) {
          await sendEmail({
            to: target,
            subject: "Whitelist approved",
            text: "Your account has been approved for the Stonepark Chromebook system. You can now sign up or sign in.",
          });
        }
      } catch (err) {
        console.warn(
          "[Notify] Failed to notify applicant:",
          err && err.message,
        );
      }

      res.json({ success: true, data: entry });
    },
  );

  // Admin: reject an application
  router.post(
    "/whitelist/applications/:email/reject",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const target = (req.params.email || "").toLowerCase();
      if (!target)
        return res
          .status(400)
          .json({ success: false, message: "email is required." });
      const existing = await whitelistRequestsDB.getByEmail(target);
      if (!existing)
        return res
          .status(404)
          .json({ success: false, message: "Application not found." });
      await whitelistRequestsDB.removeRequest(target);
      try {
        if (process.env.SMTP_HOST) {
          await sendEmail({
            to: target,
            subject: "Whitelist request rejected",
            text: "Your whitelist request was not approved.",
          });
        }
      } catch (err) {
        console.warn(
          "[Notify] Failed to notify applicant of rejection:",
          err && err.message,
        );
      }
      res.json({ success: true, message: "Application rejected." });
    },
  );

  // ── Admin User Management ──────────────────────────────────────────────────
  // These routes allow admins to pre-create staff accounts so teachers don't
  // need to self-sign-up or use Google OAuth.

  // GET /api/auth/users – list all user accounts (admin only)
  router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
    const users = await usersDB.getAll();
    res.json({ success: true, data: users });
  });

  // POST /api/auth/users – admin creates a staff (or admin) account
  router.post("/users", requireAuth, requireAdmin, async (req, res) => {
    const { email, password, name, role = "staff" } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }
    const validRoles = ["staff", "admin"];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "role must be 'staff' or 'admin'." });
    }

    const existing = await usersDB.getByEmail(email);
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          message: "An account with this email already exists.",
        });
    }

    // Auto-whitelist the new user so they can log in
    if (!(await whitelistDB.isWhitelisted(email))) {
      await whitelistDB.add(email, req.user.email);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = name && name.trim() ? name.trim() : email.split("@")[0];
    const user = await usersDB.createUser({
      email,
      name: displayName,
      role,
      passwordHash,
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
      },
    });
  });

  // PATCH /api/auth/users/:email/password – admin sets/resets any user's password
  router.patch(
    "/users/:email/password",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const targetEmail = decodeURIComponent(req.params.email || "");
      const { newPassword } = req.body;

      if (!newPassword) {
        return res
          .status(400)
          .json({ success: false, message: "newPassword is required." });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters.",
        });
      }

      const user = await usersDB.getByEmail(targetEmail);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await usersDB.adminSetPassword(targetEmail, hash);

      res.json({
        success: true,
        message: `Password updated for ${targetEmail}.`,
      });
    },
  );

  // DELETE /api/auth/users/:email – admin deletes a user account
  router.delete(
    "/users/:email",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const targetEmail = decodeURIComponent(req.params.email || "");

      if (!targetEmail) {
        return res
          .status(400)
          .json({ success: false, message: "email is required." });
      }
      if (req.user.email.toLowerCase() === targetEmail.toLowerCase()) {
        return res
          .status(400)
          .json({
            success: false,
            message: "You cannot delete your own account.",
          });
      }

      const user = await usersDB.getByEmail(targetEmail);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }
      if (user.role === "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Admin accounts cannot be deleted here. Use whitelist management.",
        });
      }

      await usersDB.deleteUser(targetEmail);
      res.json({ success: true, message: `User ${targetEmail} deleted.` });
    },
  );

  return router;
};

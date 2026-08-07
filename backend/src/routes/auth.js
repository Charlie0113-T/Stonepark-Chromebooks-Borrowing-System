/**
 * Authentication routes
 * GET  /api/auth/me            - get current user (requires auth)
 * POST /api/auth/signup        - whitelist-gated registration (returns JWT)
 * POST /api/auth/login         - password login (returns JWT)
 * POST /api/auth/logout        - logout (client-side; JWT is stateless)
 *
 * Email + password is the only sign-in method. The school's Google accounts
 * are unavailable to staff, so Google OAuth was removed deliberately —
 * do not reintroduce it without checking that constraint first.
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
  adminPromotionDB,
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

  // Normalize security answers: trim, lowercase, collapse multiple spaces
  const normalizeAnswer = (str) =>
    (str || "").trim().toLowerCase().replace(/\s+/g, " ");

  // Apply general rate limit to all auth endpoints
  router.use(authApiLimiter);

  // GET /api/auth/me
  router.get("/me", requireAuth, async (req, res) => {
    if (AUTH_BYPASS) {
      return res.json({ success: true, data: req.user });
    }
    const dbUser = await usersDB.getByEmail(req.user.email);
    res.json({
      success: true,
      data: {
        ...req.user,
        needsSecuritySetup: dbUser ? !dbUser.security_answer_1 : false,
      },
    });
  });

  // POST /api/auth/setup-security-questions – set security answers for existing users
  router.post("/setup-security-questions", requireAuth, async (req, res) => {
    const { food, book, color } = req.body;
    if (!food || !book || !color) {
      return res.status(400).json({
        success: false,
        message: "All three security answers are required.",
      });
    }

    const [answer1Hash, answer2Hash, answer3Hash] = await Promise.all([
      bcrypt.hash(normalizeAnswer(food), 10),
      bcrypt.hash(normalizeAnswer(book), 10),
      bcrypt.hash(normalizeAnswer(color), 10),
    ]);

    await usersDB.setupSecurityAnswers(
      req.user.email,
      answer1Hash,
      answer2Hash,
      answer3Hash,
    );

    res.json({
      success: true,
      message: "Security questions set up successfully.",
    });
  });

  // POST /api/auth/signup – create account (whitelist-gated registration)
  router.post("/signup", authLimiter, async (req, res) => {
    const { email, password, name, securityAnswers, rememberMe } = req.body;
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

    // Enforce whitelist: only whitelisted emails may create an account
    if (!(await isAllowedEmail(email))) {
      return res.status(403).json({
        success: false,
        message:
          "This email is not on the whitelist. Please ask an admin to add you, or apply for access.",
      });
    }

    // Require all 3 security answers
    const food = ((securityAnswers && securityAnswers.food) || "").trim();
    const book = ((securityAnswers && securityAnswers.book) || "").trim();
    const color = ((securityAnswers && securityAnswers.color) || "").trim();
    if (!food || !book || !color) {
      return res.status(400).json({
        success: false,
        message: "All three security question answers are required.",
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
    const [securityAnswer1, securityAnswer2, securityAnswer3] =
      await Promise.all([
        bcrypt.hash(normalizeAnswer(food), 10),
        bcrypt.hash(normalizeAnswer(book), 10),
        bcrypt.hash(normalizeAnswer(color), 10),
      ]);

    const displayName = name && name.trim() ? name.trim() : email.split("@")[0];
    const adminSeedEmails = getAdminSeedEmails();
    const normalizedEmail = email.toLowerCase();
    const role = adminSeedEmails.has(normalizedEmail) ? "admin" : "staff";
    const user = await usersDB.createUser({
      email,
      name: displayName,
      role,
      passwordHash,
      securityAnswer1,
      securityAnswer2,
      securityAnswer3,
    });

    const tokenExpiry = rememberMe ? "30d" : "8h";
    const token = signToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: role,
        schoolId: user.school_id || "school-default",
      },
      tokenExpiry,
    );

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
    const { email, password, rememberMe } = req.body;
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

    // 30-day expiry when "Keep me signed in" is checked
    const tokenExpiry = rememberMe ? "30d" : "8h";
    const token = signToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        schoolId: user.school_id || "school-default",
      },
      tokenExpiry,
    );
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          schoolId: user.school_id || "school-default",
          needsSecuritySetup: !user.security_answer_1,
        },
        token,
      },
    });
  });

  // POST /api/auth/logout – JWT is stateless; client should discard the token
  router.post("/logout", (req, res) => {
    res.json({
      success: true,
      message: "Logged out. Please discard your token.",
    });
  });

  // POST /api/auth/forgot-password – verify security answers and return a reset token
  router.post("/forgot-password", authLimiter, async (req, res) => {
    const { email, food, book, color } = req.body;
    if (!email || !food || !book || !color) {
      return res.status(400).json({
        success: false,
        message: "email and all three security answers are required.",
      });
    }

    const user = await usersDB.verifySecurityAnswers(email, food, book, color);
    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Incorrect answers. Please check your responses and try again.",
      });
    }

    // Generate a short-lived reset token (30 minutes)
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await usersDB.setResetToken(email, token, expiresAt);

    res.json({
      success: true,
      data: { token },
      message:
        "Security answers verified. Use the token to reset your password.",
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

  // ── Admin Promotion Votes ────────────────────────────────────────────────────

  router.get(
    "/whitelist/promotions",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const requests = await adminPromotionDB.getAll();
      const adminList = await getWhitelistedAdmins();
      const adminEmails = adminList.map((admin) => admin.email.toLowerCase());

      const data = [];
      for (const request of requests) {
        const target = (request.email || "").toLowerCase();

        // Auto-clean stale requests for users already promoted to admin
        const targetUser = await usersDB.getByEmail(target);
        if (targetUser && targetUser.role === "admin") {
          await adminPromotionDB.clearRequest(target);
          continue;
        }

        const createdBy = (request.created_by || "").toLowerCase();
        const eligibleVoters = adminEmails.filter(
          (email) => email !== createdBy && email !== target,
        );
        const required = eligibleVoters.length;
        const votes = await adminPromotionDB.countVotes(target);
        const hasVoted = await adminPromotionDB.hasVoted(
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
    "/whitelist/promotions",
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

      const targetUser = await usersDB.getByEmail(normalized);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "No account found for this email.",
        });
      }
      if (targetUser.role === "admin") {
        return res.status(409).json({
          success: false,
          message: "User is already an admin.",
        });
      }

      const adminList = await getWhitelistedAdmins();
      const adminEmails = adminList.map((admin) => admin.email.toLowerCase());
      const eligibleVoters = adminEmails.filter(
        (adminEmail) => adminEmail !== req.user.email.toLowerCase(),
      );

      if (eligibleVoters.length === 0) {
        // Only admin — promote immediately
        await usersDB.setRole(normalized, "admin");
        return res.json({
          success: true,
          data: { status: "promoted", email: normalized },
        });
      }

      const request = await adminPromotionDB.createRequest(
        normalized,
        req.user.email,
      );
      const votes = await adminPromotionDB.countVotes(normalized);

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
    "/whitelist/promotions/:email/vote",
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

      const request = await adminPromotionDB.getByEmail(targetEmail);
      if (!request) {
        return res
          .status(404)
          .json({ success: false, message: "Promotion request not found." });
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

      await adminPromotionDB.addVote(targetEmail, req.user.email);

      const eligibleVoters = adminEmails.filter(
        (adminEmail) =>
          adminEmail !== request.created_by.toLowerCase() &&
          adminEmail !== targetEmail,
      );
      const required = eligibleVoters.length;
      const votes = await adminPromotionDB.countVotes(targetEmail);

      if (votes >= required && required > 0) {
        await usersDB.setRole(targetEmail, "admin");
        await adminPromotionDB.clearRequest(targetEmail);
        return res.json({
          success: true,
          data: { status: "promoted", email: targetEmail },
        });
      }

      res.json({
        success: true,
        data: { status: "pending", email: targetEmail, votes, required },
      });
    },
  );

  // Admin: cancel a pending promotion request
  router.delete(
    "/whitelist/promotions/:email",
    requireAuth,
    requireAdmin,
    requireWhitelisted,
    async (req, res) => {
      const targetEmail = (req.params.email || "").toLowerCase();
      if (!targetEmail)
        return res
          .status(400)
          .json({ success: false, message: "email is required." });

      const request = await adminPromotionDB.getByEmail(targetEmail);
      if (!request)
        return res
          .status(404)
          .json({ success: false, message: "Promotion request not found." });

      await adminPromotionDB.clearRequest(targetEmail);
      res.json({
        success: true,
        message: `Promotion request for ${targetEmail} cancelled.`,
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
  // need to self-sign-up.

  // GET /api/auth/users – list all user accounts (admin only)
  router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
    const users = await usersDB.getAll();
    res.json({ success: true, data: users });
  });

  // POST /api/auth/users – admin creates a staff account (admin role requires promotion voting)
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
    if (role !== "staff") {
      return res.status(400).json({
        success: false,
        message:
          "Direct admin account creation is not allowed. Use the 'Promote to Admin' voting flow instead.",
      });
    }

    const existing = await usersDB.getByEmail(email);
    if (existing) {
      return res.status(409).json({
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
        return res.status(400).json({
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

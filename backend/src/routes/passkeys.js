/**
 * Passkey (WebAuthn) routes.
 *
 * POST /api/auth/passkeys/register/options  - start adding a passkey (auth required)
 * POST /api/auth/passkeys/register/verify   - finish adding a passkey (auth required)
 * POST /api/auth/passkeys/login/options     - start a passkey sign-in (public)
 * POST /api/auth/passkeys/login/verify      - finish a passkey sign-in (public)
 * GET  /api/auth/passkeys                   - list the caller's passkeys (auth required)
 * DELETE /api/auth/passkeys/:credentialId   - remove one of the caller's passkeys
 *
 * Passkeys are an *additional* sign-in method, never a replacement. Staff share
 * devices (the office iPad), swap phones and lose them, so email + password and
 * the security-question recovery path must keep working alongside this.
 *
 * Configuration:
 *   WEBAUTHN_RP_ID    – the FRONTEND domain, e.g. "stonepark-chromebook-manager.vercel.app"
 *   WEBAUTHN_ORIGIN   – full frontend origin(s), comma-separated for multiple
 *   WEBAUTHN_RP_NAME  – display name shown in the OS passkey prompt
 *
 * WARNING: a passkey is permanently bound to WEBAUTHN_RP_ID. If the frontend
 * ever moves to a different domain, every staff passkey silently stops working
 * and all of them must be re-registered. Change this value only deliberately.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const { randomUUID } = require("node:crypto");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const { usersDB, passkeysDB } = require("../db/database");
const {
  signToken,
  requireAuth,
  isAllowedEmail,
} = require("../middleware/auth");

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// ── Configuration ─────────────────────────────────────────────────────────────

function resolveRpConfig() {
  const rpID = (process.env.WEBAUTHN_RP_ID || "").trim();
  const rawOrigin = (process.env.WEBAUTHN_ORIGIN || "").trim();
  const rpName =
    (process.env.WEBAUTHN_RP_NAME || "").trim() ||
    "Stonepark Chromebook Manager";

  if (rpID && rawOrigin) {
    return {
      configured: true,
      rpID,
      rpName,
      origins: rawOrigin
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    };
  }

  // Local development convenience only. Never silently guess in production —
  // a wrong RP ID produces passkeys that appear to work and then cannot be
  // verified, which is far worse than an obvious "not configured" response.
  if (process.env.NODE_ENV !== "production") {
    return {
      configured: true,
      rpID: "localhost",
      rpName,
      origins: ["http://localhost:3000", "http://localhost:4000"],
    };
  }

  return { configured: false };
}

const RP = resolveRpConfig();

if (!RP.configured) {
  console.warn(
    "[Passkeys] WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN are not set. " +
      "Passkey endpoints will return 501 until they are configured with the " +
      "frontend's domain. Password sign-in is unaffected.",
  );
}

function requirePasskeyConfig(req, res, next) {
  if (!RP.configured) {
    return res.status(501).json({
      success: false,
      message: "Passkeys are not configured on this server.",
    });
  }
  next();
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

// Passkey sign-in is unauthenticated, so it gets its own limiter.
const passkeyLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sign-in attempts. Please try again later.",
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const toBase64Url = (bytes) => Buffer.from(bytes).toString("base64url");
const fromBase64Url = (str) => new Uint8Array(Buffer.from(str, "base64url"));

function parseTransports(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Best-effort friendly name so teachers can tell their devices apart. */
function deviceLabelFromUserAgent(userAgent) {
  const ua = String(userAgent || "");
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android device";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  return "Passkey";
}

async function storeChallenge(email, challenge, purpose) {
  const id = randomUUID();
  await passkeysDB.saveChallenge({
    id,
    email: email || null,
    challenge,
    purpose,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });
  // Opportunistic cleanup; failure here must not break the sign-in attempt.
  passkeysDB.purgeExpiredChallenges().catch(() => {});
  return id;
}

module.exports = function createPasskeysRouter() {
  const router = express.Router();

  // ── Registration (teacher is already signed in) ────────────────────────────

  router.post(
    "/register/options",
    requirePasskeyConfig,
    requireAuth,
    async (req, res) => {
      const user = await usersDB.getByEmail(req.user.email);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      const existing = await passkeysDB.getByUserEmail(user.email);

      const options = await generateRegistrationOptions({
        rpName: RP.rpName,
        rpID: RP.rpID,
        userID: new Uint8Array(Buffer.from(user.id, "utf8")),
        userName: user.email,
        userDisplayName: user.name || user.email,
        attestationType: "none",
        // Stops the teacher from registering the same device twice and then
        // wondering why they have three identical entries.
        excludeCredentials: existing.map((cred) => ({
          id: cred.credential_id,
          transports: parseTransports(cred.transports),
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      const challengeId = await storeChallenge(
        user.email,
        options.challenge,
        "registration",
      );

      res.json({ success: true, data: { options, challengeId } });
    },
  );

  router.post(
    "/register/verify",
    requirePasskeyConfig,
    requireAuth,
    async (req, res) => {
      const { response, challengeId } = req.body;
      if (!response || !challengeId) {
        return res.status(400).json({
          success: false,
          message: "response and challengeId are required.",
        });
      }

      const stored = await passkeysDB.consumeChallenge(
        challengeId,
        "registration",
      );
      if (!stored) {
        return res.status(400).json({
          success: false,
          message: "This registration attempt expired. Please try again.",
        });
      }
      // The challenge is bound to whoever requested it; a different signed-in
      // user must not be able to complete it.
      if ((stored.email || "") !== req.user.email.toLowerCase()) {
        return res
          .status(403)
          .json({ success: false, message: "Challenge does not match user." });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: stored.challenge,
          expectedOrigin: RP.origins,
          expectedRPID: RP.rpID,
          requireUserVerification: false,
        });
      } catch (err) {
        console.error("[Passkeys] Registration verification failed:", err);
        return res.status(400).json({
          success: false,
          message: "Could not verify this passkey. Please try again.",
        });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return res
          .status(400)
          .json({ success: false, message: "Passkey verification failed." });
      }

      const { credential } = verification.registrationInfo;
      await passkeysDB.create({
        credentialId: credential.id,
        userEmail: req.user.email,
        publicKey: toBase64Url(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports || [],
        deviceLabel: deviceLabelFromUserAgent(req.headers["user-agent"]),
      });

      res.status(201).json({
        success: true,
        message: "Passkey added. You can now sign in with it.",
      });
    },
  );

  // ── Sign-in (public) ───────────────────────────────────────────────────────

  router.post(
    "/login/options",
    requirePasskeyConfig,
    passkeyLoginLimiter,
    async (req, res) => {
      const { email } = req.body || {};

      // With no email we issue a "discoverable credential" challenge: the
      // browser shows whatever passkeys it holds for this site. That is the
      // one-tap flow, and it also avoids telling an anonymous caller whether
      // a given address has an account.
      let allowCredentials;
      if (email) {
        const creds = await passkeysDB.getByUserEmail(email);
        allowCredentials = creds.map((cred) => ({
          id: cred.credential_id,
          transports: parseTransports(cred.transports),
        }));
      }

      const options = await generateAuthenticationOptions({
        rpID: RP.rpID,
        userVerification: "preferred",
        ...(allowCredentials && allowCredentials.length > 0
          ? { allowCredentials }
          : {}),
      });

      const challengeId = await storeChallenge(
        email || null,
        options.challenge,
        "authentication",
      );

      res.json({ success: true, data: { options, challengeId } });
    },
  );

  router.post(
    "/login/verify",
    requirePasskeyConfig,
    passkeyLoginLimiter,
    async (req, res) => {
      const { response, challengeId, rememberMe } = req.body;
      if (!response || !challengeId) {
        return res.status(400).json({
          success: false,
          message: "response and challengeId are required.",
        });
      }

      const stored = await passkeysDB.consumeChallenge(
        challengeId,
        "authentication",
      );
      if (!stored) {
        return res.status(400).json({
          success: false,
          message: "This sign-in attempt expired. Please try again.",
        });
      }

      const credentialRecord = await passkeysDB.getByCredentialId(response.id);
      if (!credentialRecord) {
        return res
          .status(401)
          .json({ success: false, message: "Unrecognised passkey." });
      }

      // The account must still exist and still be whitelisted. Without these
      // checks a passkey would outlive the access it was granted under.
      const user = await usersDB.getByEmail(credentialRecord.user_email);
      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: "Account no longer exists." });
      }
      if (!(await isAllowedEmail(user.email))) {
        return res.status(403).json({
          success: false,
          message: "This account is not on the whitelist.",
        });
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: stored.challenge,
          expectedOrigin: RP.origins,
          expectedRPID: RP.rpID,
          requireUserVerification: false,
          credential: {
            id: credentialRecord.credential_id,
            publicKey: fromBase64Url(credentialRecord.public_key),
            counter: Number(credentialRecord.counter) || 0,
            transports: parseTransports(credentialRecord.transports),
          },
        });
      } catch (err) {
        console.error("[Passkeys] Authentication verification failed:", err);
        return res
          .status(401)
          .json({ success: false, message: "Passkey sign-in failed." });
      }

      if (!verification.verified) {
        return res
          .status(401)
          .json({ success: false, message: "Passkey sign-in failed." });
      }

      await passkeysDB.updateCounter(
        credentialRecord.credential_id,
        verification.authenticationInfo.newCounter,
      );

      const token = signToken(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.school_id || "school-default",
        },
        rememberMe ? "30d" : "8h",
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            schoolId: user.school_id || "school-default",
            needsSecuritySetup: !user.security_answer_1,
          },
          token,
        },
      });
    },
  );

  // ── Management ─────────────────────────────────────────────────────────────

  router.get("/", requirePasskeyConfig, requireAuth, async (req, res) => {
    const creds = await passkeysDB.getByUserEmail(req.user.email);
    res.json({
      success: true,
      data: creds.map((cred) => ({
        credentialId: cred.credential_id,
        deviceLabel: cred.device_label || "Passkey",
        createdAt: cred.created_at,
        lastUsedAt: cred.last_used_at,
      })),
    });
  });

  router.delete(
    "/:credentialId",
    requirePasskeyConfig,
    requireAuth,
    async (req, res) => {
      const removed = await passkeysDB.remove(
        decodeURIComponent(req.params.credentialId || ""),
        req.user.email,
      );
      if (!removed) {
        return res
          .status(404)
          .json({ success: false, message: "Passkey not found." });
      }
      res.json({ success: true, message: "Passkey removed." });
    },
  );

  return router;
};

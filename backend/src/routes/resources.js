/**
 * Resources REST routes
 * GET    /api/resources        - list all resources with current status (?schoolId=)
 * GET    /api/resources/:id    - get single resource
 * POST   /api/resources        - create a new resource
 * PUT    /api/resources/:id    - update a resource
 * DELETE /api/resources/:id    - delete a resource (blocked if active bookings)
 */

const express = require("express");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { resourcesDB, bookingsDB, usersDB } = require("../db/database");
const { enrichResourceDB, getBookedQuantityDB } = require("../models/booking");
const {
  requireAuth,
  requireWhitelisted,
  isAllowedEmail,
} = require("../middleware/auth");

const RESOURCE_TYPE = { CABINET: "cabinet", SINGLE: "single" };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = function createResourcesRouter() {
  const router = express.Router();

  // GET /api/resources
  router.get("/", async (req, res) => {
    const resources = await resourcesDB.getAll(req.query.schoolId);
    const enriched = await Promise.all(
      resources.map((r) => enrichResourceDB(r)),
    );
    res.json({ success: true, data: enriched });
  });

  // GET /api/resources/:id/return-via-qr
  // Renders a mobile-friendly HTML page showing active bookings for the cabinet.
  // Admin selects a booking and enters credentials to confirm the return.
  router.get("/:id/return-via-qr", async (req, res) => {
    const resource = await resourcesDB.getById(req.params.id);
    if (!resource) {
      return res.status(404).send("<h2>Resource not found.</h2>");
    }

    const activeBookings = await bookingsDB.getAll({
      resourceId: req.params.id,
      status: "active",
    });

    const { format } = require("date-fns");
    const fmtDt = (iso) => {
      try {
        return format(new Date(iso), "MMM d, HH:mm");
      } catch {
        return iso;
      }
    };

    const bookingRows = activeBookings
      .map(
        (b) => `
      <label class="booking-label">
        <input type="radio" name="bookingId" value="${escapeHtml(b.id)}" required />
        <div class="booking-info">
          <div class="booking-name">${escapeHtml(b.borrower)}</div>
          <div class="booking-meta">${escapeHtml(b.borrowerClass)}${b.quantity > 1 ? ` · Qty: ${b.quantity}` : ""}</div>
          <div class="booking-meta">📅 ${escapeHtml(fmtDt(b.startTime))} → 🏁 ${escapeHtml(fmtDt(b.endTime))}</div>
          ${b.notes ? `<div class="booking-meta">📝 ${escapeHtml(b.notes)}</div>` : ""}
        </div>
      </label>
    `,
      )
      .join("<hr class='booking-divider'/>");

    const formSection =
      activeBookings.length === 0
        ? `<div class="card"><p class="no-bookings">✅ No active bookings for this cabinet.</p></div>`
        : `<form method="POST" action="/api/resources/${escapeHtml(resource.id)}/return-via-qr">
          <div class="card">
            <p class="section-title">Select booking to return:</p>
            ${bookingRows}
          </div>
          <div class="card">
            <div class="field">
              <label for="email">Admin Email</label>
              <input id="email" name="email" type="email" required autocomplete="email" />
            </div>
            <div class="field">
              <label for="password">Admin Password</label>
              <input id="password" name="password" type="password" required autocomplete="current-password" />
            </div>
            <button type="submit">✅ Confirm Return</button>
          </div>
        </form>`;

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Return Chromebooks</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;max-width:500px;margin:0 auto;color:#222}
    h2{font-size:20px;margin-bottom:4px}
    .sub{color:#666;font-size:13px;margin-bottom:20px}
    .card{background:#fff;border:1px solid #e0e0e0;border-radius:10px;padding:16px;margin-bottom:14px}
    .section-title{font-weight:700;font-size:14px;margin-bottom:10px}
    .booking-label{display:flex;gap:12px;align-items:flex-start;padding:8px 0;cursor:pointer}
    .booking-label input[type=radio]{margin-top:3px;accent-color:#333;width:16px;height:16px;flex-shrink:0}
    .booking-info{flex:1}
    .booking-name{font-weight:600;font-size:14px}
    .booking-meta{font-size:12px;color:#666;margin-top:2px}
    .booking-divider{border:none;border-top:1px solid #f0f0f0;margin:4px 0}
    .no-bookings{text-align:center;color:#666;padding:10px 0;font-size:14px}
    .field{margin-top:12px}
    .field label{display:block;font-size:13px;font-weight:600;margin-bottom:5px}
    .field input{width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:7px;font-size:14px}
    .field input:focus{outline:none;border-color:#333}
    button{width:100%;padding:13px;margin-top:16px;background:#333;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.3px}
    button:active{background:#555}
  </style>
</head>
<body>
  <h2>Return Chromebooks</h2>
  <p class="sub">📦 ${escapeHtml(resource.name)} — ${escapeHtml(resource.classRoom)}</p>
  ${formSection}
</body>
</html>`);
  });

  // POST /api/resources/:id/return-via-qr
  // Verifies admin credentials and marks the selected booking as returned.
  router.post("/:id/return-via-qr", async (req, res) => {
    const resource = await resourcesDB.getById(req.params.id);
    if (!resource) {
      return res.status(404).send("<h2>Resource not found.</h2>");
    }

    const { email, password, bookingId } = req.body;
    if (!email || !password || !bookingId) {
      return res.status(400).send("<h2>Missing required fields.</h2>");
    }

    if (!(await isAllowedEmail(email))) {
      return res
        .status(403)
        .send("<h2>This email is not on the whitelist.</h2>");
    }

    const user = await usersDB.getByEmail(email);
    if (!user || user.role !== "admin" || !user.password_hash) {
      return res.status(403).send("<h2>Admin access required.</h2>");
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Error</title>
<style>body{font-family:Arial,sans-serif;padding:24px;max-width:500px;margin:0 auto}
a{color:#333;font-size:14px}</style></head>
<body><h2>❌ Invalid credentials</h2><p style="margin:12px 0;color:#555">Please go back and try again.</p>
<a href="/api/resources/${escapeHtml(resource.id)}/return-via-qr">← Go back</a></body></html>`);
    }

    const booking = await bookingsDB.getById(bookingId);
    if (!booking || booking.resourceId !== resource.id) {
      return res
        .status(404)
        .send("<h2>Booking not found for this resource.</h2>");
    }
    if (booking.status !== "active") {
      return res.send(
        `<h2>No action needed.</h2><p>Booking is already ${escapeHtml(booking.status)}.</p>`,
      );
    }

    await bookingsDB.update(bookingId, {
      status: "returned",
      actualReturnTime: new Date().toISOString(),
    });

    return res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Returned</title>
<style>body{font-family:Arial,sans-serif;padding:24px;max-width:500px;margin:0 auto;text-align:center}
.icon{font-size:48px;margin-bottom:12px}.info{color:#555;font-size:14px;margin-top:8px}</style></head>
<body>
  <div class="icon">✅</div>
  <h2>Return Confirmed</h2>
  <p class="info">📦 ${escapeHtml(resource.name)}</p>
  <p class="info">👤 ${escapeHtml(booking.borrower)} (${escapeHtml(booking.borrowerClass)})</p>
  <p class="info" style="margin-top:16px;color:#28a745;font-weight:700">Successfully returned</p>
</body></html>`);
  });

  // GET /api/resources/:id
  router.get("/:id", async (req, res) => {
    const resource = await resourcesDB.getById(req.params.id);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found." });
    }
    res.json({ success: true, data: await enrichResourceDB(resource) });
  });

  // POST /api/resources
  router.post("/", requireAuth, requireWhitelisted, async (req, res) => {
    const { type, name, classRoom, totalQuantity, description, schoolId } =
      req.body;

    if (!type || !name || !classRoom || totalQuantity == null) {
      return res.status(400).json({
        success: false,
        message: "type, name, classRoom and totalQuantity are required.",
      });
    }
    if (!Object.values(RESOURCE_TYPE).includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${Object.values(RESOURCE_TYPE).join(", ")}`,
      });
    }
    const qty = parseInt(totalQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({
        success: false,
        message: "totalQuantity must be a positive integer.",
      });
    }
    if (type === RESOURCE_TYPE.SINGLE && qty !== 1) {
      return res.status(400).json({
        success: false,
        message: "Single-device resources must have totalQuantity of 1.",
      });
    }

    const resource = await resourcesDB.create({
      id: randomUUID(),
      type,
      name,
      classRoom,
      totalQuantity: qty,
      description: description || "",
      schoolId: schoolId || "school-default",
    });
    res
      .status(201)
      .json({ success: true, data: await enrichResourceDB(resource) });
  });

  // PUT /api/resources/:id
  router.put("/:id", requireAuth, requireWhitelisted, async (req, res) => {
    const resource = await resourcesDB.getById(req.params.id);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found." });
    }
    const { name, classRoom, description, totalQuantity } = req.body;
    const updates = {};

    if (name != null) updates.name = name;
    if (classRoom != null) updates.classRoom = classRoom;
    if (description != null) updates.description = description;

    // Track who made the edit
    if (req.user && req.user.email) {
      updates.lastModifiedBy = req.user.name || req.user.email;
    }

    if (totalQuantity != null) {
      const qty = parseInt(totalQuantity, 10);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({
          success: false,
          message: "totalQuantity must be a positive integer.",
        });
      }
      if (resource.type === RESOURCE_TYPE.SINGLE && qty !== 1) {
        return res.status(400).json({
          success: false,
          message: "Single-device resources must have totalQuantity of 1.",
        });
      }
      const now = new Date().toISOString();
      const currentBooked = await getBookedQuantityDB(resource.id, now, now);
      if (qty < currentBooked) {
        return res.status(409).json({
          success: false,
          message: `Cannot reduce totalQuantity to ${qty}; ${currentBooked} units are currently booked.`,
        });
      }
      updates.totalQuantity = qty;
    }

    const updated = await resourcesDB.update(req.params.id, updates);
    res.json({ success: true, data: await enrichResourceDB(updated) });
  });

  // DELETE /api/resources/:id
  router.delete("/:id", requireAuth, requireWhitelisted, async (req, res) => {
    const resource = await resourcesDB.getById(req.params.id);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found." });
    }
    if (await resourcesDB.hasActiveBookings(req.params.id)) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete resource with active bookings.",
      });
    }
    await resourcesDB.delete(req.params.id);
    res.json({ success: true, message: "Resource deleted." });
  });

  return router;
};

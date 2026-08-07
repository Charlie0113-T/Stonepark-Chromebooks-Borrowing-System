/**
 * Bookings REST routes
 * GET    /api/bookings              - list all bookings (optional ?resourceId=, ?status=, ?search=, ?schoolId=)
 * GET    /api/bookings/:id          - get single booking
 * POST   /api/bookings              - create booking (with conflict detection)
 * PATCH  /api/bookings/:id/return   - mark a booking as returned
 * PATCH  /api/bookings/:id/cancel   - cancel a booking
 *
 * Every route requires a whitelisted account. Bookings name the staff who
 * borrowed each device, so none of it is public.
 *
 * Returning via QR goes through the frontend /scan/:id page, which signs the
 * teacher in once and keeps them signed in. There is deliberately no
 * server-rendered credential form here: it made staff retype their password on
 * a phone at every return, and gave anyone with the URL an unthrottled place
 * to guess passwords.
 */

const express = require("express");
const { randomUUID } = require("node:crypto");
const { resourcesDB, bookingsDB } = require("../db/database");
const { checkConflictDB, isBookingOverdue } = require("../models/booking");
const {
  notifyBookingCreated,
  notifyBookingReturned,
} = require("../services/notifications");
const { requireAuth, requireWhitelisted } = require("../middleware/auth");

module.exports = function createBookingsRouter() {
  const router = express.Router();

  // GET /api/bookings
  router.get("/", requireAuth, requireWhitelisted, async (req, res) => {
    const { resourceId, status, search, schoolId } = req.query;
    let result = await bookingsDB.getAll({
      resourceId,
      status,
      search,
      schoolId,
    });

    // Sort: overdue active first, then active, then returned, then cancelled
    const statusOrder = { active: 0, returned: 1, cancelled: 2 };
    result.sort((a, b) => {
      const aOverdue = isBookingOverdue(a) ? 0 : 1;
      const bOverdue = isBookingOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const aStatus = statusOrder[a.status] ?? 3;
      const bStatus = statusOrder[b.status] ?? 3;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return new Date(b.startTime) - new Date(a.startTime);
    });

    const data = result.map((b) => ({ ...b, isOverdue: isBookingOverdue(b) }));
    res.json({ success: true, data });
  });

  // GET /api/bookings/:id
  router.get("/:id", requireAuth, requireWhitelisted, async (req, res) => {
    const booking = await bookingsDB.getById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });
    }
    res.json({
      success: true,
      data: { ...booking, isOverdue: isBookingOverdue(booking) },
    });
  });

  // POST /api/bookings - create new booking
  router.post("/", requireAuth, requireWhitelisted, async (req, res) => {
    const {
      resourceId,
      borrower,
      borrowerClass,
      quantity,
      startTime,
      endTime,
      notes,
    } = req.body;

    // Validate required fields
    if (!resourceId || !borrower || !borrowerClass || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message:
          "resourceId, borrower, borrowerClass, startTime and endTime are required.",
      });
    }

    // Validate date formats
    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({
        success: false,
        message: "startTime and endTime must be valid ISO 8601 date strings.",
      });
    }
    if (parsedEnd <= parsedStart) {
      return res.status(400).json({
        success: false,
        message: "endTime must be after startTime.",
      });
    }

    // Validate string lengths
    if (borrower.length > 200) {
      return res.status(400).json({
        success: false,
        message: "borrower name is too long (max 200 characters).",
      });
    }
    if (borrowerClass.length > 100) {
      return res.status(400).json({
        success: false,
        message: "borrowerClass is too long (max 100 characters).",
      });
    }
    if (notes && notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "notes is too long (max 1000 characters).",
      });
    }

    const resource = await resourcesDB.getById(resourceId);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found." });
    }

    const requestedQty =
      resource.type === "single" ? 1 : parseInt(quantity, 10);
    if (
      resource.type !== "single" &&
      (isNaN(requestedQty) || requestedQty < 1)
    ) {
      return res.status(400).json({
        success: false,
        message: "quantity must be a positive integer for cabinet resources.",
      });
    }
    if (requestedQty > resource.totalQuantity) {
      return res.status(400).json({
        success: false,
        message: `Requested quantity (${requestedQty}) exceeds resource total (${resource.totalQuantity}).`,
      });
    }

    // Conflict detection
    const conflict = await checkConflictDB(
      resource,
      startTime,
      endTime,
      requestedQty,
    );
    if (!conflict.ok) {
      return res.status(409).json({ success: false, message: conflict.reason });
    }

    const booking = await bookingsDB.create({
      id: randomUUID(),
      resourceId,
      borrower,
      borrowerClass,
      quantity: requestedQty,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      actualReturnTime: null,
      status: "active",
      notes: notes || "",
      createdBy: req.user ? req.user.name || req.user.email : null,
    });

    // Fire-and-forget notification
    notifyBookingCreated(booking, resource).catch(() => {});

    res.status(201).json({ success: true, data: booking });
  });

  // PATCH /api/bookings/:id/return
  router.patch(
    "/:id/return",
    requireAuth,
    requireWhitelisted,
    async (req, res) => {
      const booking = await bookingsDB.getById(req.params.id);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found." });
      }
      if (booking.status !== "active") {
        return res.status(400).json({
          success: false,
          message: `Booking is already ${booking.status}.`,
        });
      }
      const updated = await bookingsDB.update(req.params.id, {
        status: "returned",
        actualReturnTime: new Date().toISOString(),
      });

      // Fire-and-forget notification
      const resource = await resourcesDB.getById(booking.resourceId);
      if (resource) notifyBookingReturned(updated, resource).catch(() => {});

      res.json({ success: true, data: updated });
    },
  );

  // PATCH /api/bookings/:id/cancel
  router.patch(
    "/:id/cancel",
    requireAuth,
    requireWhitelisted,
    async (req, res) => {
      const booking = await bookingsDB.getById(req.params.id);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found." });
      }
      if (booking.status !== "active") {
        return res.status(400).json({
          success: false,
          message: `Booking is already ${booking.status}.`,
        });
      }
      const updated = await bookingsDB.update(req.params.id, {
        status: "cancelled",
      });
      res.json({ success: true, data: updated });
    },
  );

  return router;
};

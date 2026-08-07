/**
 * Resources REST routes
 * GET    /api/resources                - list all resources with current status (?schoolId=)
 * GET    /api/resources/:id            - get single resource
 * GET    /api/resources/:id/history    - field change history
 * POST   /api/resources                - create a new resource
 * POST   /api/resources/:id/return-all - return every active booking (QR scan flow)
 * PUT    /api/resources/:id            - update a resource
 * DELETE /api/resources/:id            - delete a resource (blocked if active bookings)
 *
 * Every route requires a whitelisted account. Booking data names the staff who
 * borrowed each device, so none of it is public.
 */

const express = require("express");
const { randomUUID } = require("node:crypto");
const {
  resourcesDB,
  bookingsDB,
  resourceHistoryDB,
} = require("../db/database");
const { enrichResourceDB, getBookedQuantityDB } = require("../models/booking");
const { notifyBookingReturned } = require("../services/notifications");
const {
  requireAuth,
  requireWhitelisted,
  requireAdmin,
} = require("../middleware/auth");

const RESOURCE_TYPE = { CABINET: "cabinet", SINGLE: "single" };

module.exports = function createResourcesRouter() {
  const router = express.Router();

  // GET /api/resources
  router.get("/", requireAuth, requireWhitelisted, async (req, res) => {
    const resources = await resourcesDB.getAll(req.query.schoolId);
    const enriched = await Promise.all(
      resources.map((r) => enrichResourceDB(r)),
    );
    res.json({ success: true, data: enriched });
  });

  // POST /api/resources/:id/return-all
  // Authenticated via JWT (Bearer token) — returns all active bookings for a resource.
  // Designed for the QR scan mobile flow where the teacher's token is auto-sent.
  router.post(
    "/:id/return-all",
    requireAuth,
    requireWhitelisted,
    async (req, res) => {
      try {
        const resource = await resourcesDB.getById(req.params.id);
        if (!resource) {
          return res
            .status(404)
            .json({ success: false, message: "Resource not found." });
        }

        const activeBookings = await bookingsDB.getAll({
          resourceId: req.params.id,
          status: "active",
        });

        if (activeBookings.length === 0) {
          return res.json({
            success: true,
            message: "No active bookings to return.",
            data: { returned: 0, bookings: [] },
          });
        }

        const returned = [];
        for (const booking of activeBookings) {
          const updated = await bookingsDB.update(booking.id, {
            status: "returned",
            actualReturnTime: new Date().toISOString(),
          });
          returned.push(updated);
          notifyBookingReturned(updated, resource).catch(() => {});
        }

        res.json({
          success: true,
          message: `Returned ${returned.length} booking(s).`,
          data: { returned: returned.length, bookings: returned },
        });
      } catch (err) {
        console.error(
          "[Resources] return-all failed for id:",
          req.params.id,
          err,
        );
        res
          .status(500)
          .json({ success: false, message: "Failed to process returns." });
      }
    },
  );

  // GET /api/resources/:id
  router.get("/:id", requireAuth, requireWhitelisted, async (req, res) => {
    const resource = await resourcesDB.getById(req.params.id);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found." });
    }
    res.json({ success: true, data: await enrichResourceDB(resource) });
  });

  // GET /api/resources/:id/history
  router.get(
    "/:id/history",
    requireAuth,
    requireWhitelisted,
    async (req, res) => {
      const resource = await resourcesDB.getById(req.params.id);
      if (!resource) {
        return res
          .status(404)
          .json({ success: false, message: "Resource not found." });
      }

      const entries = await resourceHistoryDB.getAllByResourceId(req.params.id);
      res.json({ success: true, data: entries });
    },
  );

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

    const changedBy =
      (req.user && (req.user.name || req.user.email)) || "Unknown user";

    if (name != null && resource.name !== updated.name) {
      await resourceHistoryDB.create({
        id: randomUUID(),
        resourceId: resource.id,
        action: "update",
        field: "name",
        oldValue: resource.name || "",
        newValue: updated.name || "",
        changedBy,
      });
    }

    if (classRoom != null && resource.classRoom !== updated.classRoom) {
      await resourceHistoryDB.create({
        id: randomUUID(),
        resourceId: resource.id,
        action: "update",
        field: "classRoom",
        oldValue: resource.classRoom || "",
        newValue: updated.classRoom || "",
        changedBy,
      });
    }

    if (description != null && resource.description !== updated.description) {
      await resourceHistoryDB.create({
        id: randomUUID(),
        resourceId: resource.id,
        action: "update",
        field: "description",
        oldValue: resource.description || "",
        newValue: updated.description || "",
        changedBy,
      });
    }

    res.json({ success: true, data: await enrichResourceDB(updated) });
  });

  // DELETE /api/resources/:id
  router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
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
    } catch (err) {
      console.error("[Resources] Delete failed for id:", req.params.id, err);
      res.status(500).json({
        success: false,
        message: "Failed to delete resource. Please try again.",
      });
    }
  });

  return router;
};

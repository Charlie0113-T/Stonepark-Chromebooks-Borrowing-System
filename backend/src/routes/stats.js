/**
 * Statistics / analytics route
 * GET /api/stats  - summary statistics (?schoolId=)
 */

const express = require("express");
const { resourcesDB, bookingsDB } = require("../db/database");
const { getBookedQuantityDB, isBookingOverdue } = require("../models/booking");

module.exports = function createStatsRouter() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const { schoolId } = req.query;
    const now = new Date().toISOString();

    const resources = await resourcesDB.getAll(schoolId);
    const bookings = await bookingsDB.getAll({ schoolId });

    // Per-resource utilisation
    const resourceStats = await Promise.all(
      resources.map(async (r) => {
        const currentBooked = await getBookedQuantityDB(r.id, now, now);
        const utilisation =
          r.totalQuantity > 0
            ? Math.round((currentBooked / r.totalQuantity) * 100)
            : 0;
        return {
          id: r.id,
          name: r.name,
          type: r.type,
          classRoom: r.classRoom,
          totalQuantity: r.totalQuantity,
          currentBooked,
          availableNow: r.totalQuantity - currentBooked,
          utilisationPct: utilisation,
        };
      }),
    );

    // Totals
    const totalResources = resources.length;
    const totalBookings = bookings.length;
    const activeBookings = bookings.filter((b) => b.status === "active").length;
    const returnedBookings = bookings.filter(
      (b) => b.status === "returned",
    ).length;
    const cancelledBookings = bookings.filter(
      (b) => b.status === "cancelled",
    ).length;
    const overdueBookings = bookings.filter((b) => isBookingOverdue(b)).length;
    const totalChromebooks = resources.reduce(
      (sum, r) => sum + r.totalQuantity,
      0,
    );
    const fullyBookedNow = resourceStats.filter(
      (r) => r.currentBooked >= r.totalQuantity,
    ).length;

    // Staff/admin usage breakdown
    const staffUsageMap = {};
    for (const b of bookings) {
      const key = b.createdBy || "unknown";
      if (!staffUsageMap[key]) {
        staffUsageMap[key] = { name: key, total: 0, active: 0, returned: 0 };
      }
      staffUsageMap[key].total++;
      if (b.status === "active") staffUsageMap[key].active++;
      if (b.status === "returned") staffUsageMap[key].returned++;
    }
    const staffUsage = Object.values(staffUsageMap).sort(
      (a, b) => b.total - a.total,
    );
    const totalUniqueStaff = staffUsage.length;

    res.json({
      success: true,
      data: {
        totalResources,
        totalBookings,
        activeBookings,
        returnedBookings,
        cancelledBookings,
        overdueBookings,
        totalChromebooks,
        fullyBookedResources: fullyBookedNow,
        resourceStats,
        staffUsage,
        totalUniqueStaff,
      },
    });
  });

  return router;
};

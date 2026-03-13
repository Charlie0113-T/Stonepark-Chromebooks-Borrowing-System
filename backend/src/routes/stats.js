/**
 * Statistics / analytics route
 * GET /api/stats  - summary statistics
 */

const express = require('express');
const { resources, bookings, BOOKING_STATUS } = require('../data/store');
const { getBookedQuantity, isBookingOverdue } = require('../models/booking');

module.exports = function createStatsRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    const now = new Date().toISOString();

    // Per-resource utilisation
    const resourceStats = resources.map((r) => {
      const currentBooked = getBookedQuantity(bookings, r.id, now, now);
      const utilisation = r.totalQuantity > 0 ? Math.round((currentBooked / r.totalQuantity) * 100) : 0;
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
    });

    // Totals
    const totalResources = resources.length;
    const totalBookings = bookings.length;
    const activeBookings = bookings.filter((b) => b.status === BOOKING_STATUS.ACTIVE).length;
    const returnedBookings = bookings.filter((b) => b.status === BOOKING_STATUS.RETURNED).length;
    const cancelledBookings = bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length;
    const overdueBookings = bookings.filter((b) => isBookingOverdue(b)).length;
    const totalChromebooks = resources.reduce((sum, r) => sum + r.totalQuantity, 0);

    // Conflict rate: bookings that were rejected are not stored, so we approximate
    // by counting how many resources are currently at 100% utilisation
    const fullyBookedNow = resourceStats.filter((r) => r.currentBooked >= r.totalQuantity).length;

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
      },
    });
  });

  return router;
};

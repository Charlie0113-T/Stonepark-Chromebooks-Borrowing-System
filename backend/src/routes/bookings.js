/**
 * Bookings REST routes
 * GET    /api/bookings              - list all bookings (optional ?resourceId=, ?status=)
 * GET    /api/bookings/:id          - get single booking
 * POST   /api/bookings              - create booking (with conflict detection)
 * PATCH  /api/bookings/:id/return   - mark a booking as returned
 * PATCH  /api/bookings/:id/cancel   - cancel a booking
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { resources, bookings, BOOKING_STATUS } = require('../data/store');
const { checkConflict, isBookingOverdue } = require('../models/booking');

module.exports = function createBookingsRouter() {
  const router = express.Router();

  // GET /api/bookings
  router.get('/', (req, res) => {
    let result = [...bookings];
    if (req.query.resourceId) {
      result = result.filter((b) => b.resourceId === req.query.resourceId);
    }
    if (req.query.status) {
      result = result.filter((b) => b.status === req.query.status);
    }
    if (req.query.search) {
      const term = req.query.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.borrower?.toLowerCase().includes(term) ||
          b.borrowerClass?.toLowerCase().includes(term)
      );
    }

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
  router.get('/:id', (req, res) => {
    const booking = bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: { ...booking, isOverdue: isBookingOverdue(booking) } });
  });

  // POST /api/bookings - create new booking
  router.post('/', (req, res) => {
    const { resourceId, borrower, borrowerClass, quantity, startTime, endTime, notes } = req.body;

    // Validate required fields
    if (!resourceId || !borrower || !borrowerClass || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'resourceId, borrower, borrowerClass, startTime and endTime are required.',
      });
    }

    const resource = resources.find((r) => r.id === resourceId);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    const requestedQty = resource.type === 'single' ? 1 : parseInt(quantity, 10);
    if (resource.type !== 'single' && (isNaN(requestedQty) || requestedQty < 1)) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer for cabinet resources.' });
    }
    if (requestedQty > resource.totalQuantity) {
      return res.status(400).json({
        success: false,
        message: `Requested quantity (${requestedQty}) exceeds resource total (${resource.totalQuantity}).`,
      });
    }

    // Conflict detection
    const conflict = checkConflict(resource, bookings, startTime, endTime, requestedQty);
    if (!conflict.ok) {
      return res.status(409).json({ success: false, message: conflict.reason });
    }

    const booking = {
      id: uuidv4(),
      resourceId,
      borrower,
      borrowerClass,
      quantity: requestedQty,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      actualReturnTime: null,
      status: BOOKING_STATUS.ACTIVE,
      notes: notes || '',
    };
    bookings.push(booking);
    res.status(201).json({ success: true, data: booking });
  });

  // PATCH /api/bookings/:id/return
  router.patch('/:id/return', (req, res) => {
    const booking = bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== BOOKING_STATUS.ACTIVE) {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
    }
    booking.status = BOOKING_STATUS.RETURNED;
    booking.actualReturnTime = new Date().toISOString();
    res.json({ success: true, data: booking });
  });

  // PATCH /api/bookings/:id/cancel
  router.patch('/:id/cancel', (req, res) => {
    const booking = bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== BOOKING_STATUS.ACTIVE) {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
    }
    booking.status = BOOKING_STATUS.CANCELLED;
    res.json({ success: true, data: booking });
  });

  return router;
};

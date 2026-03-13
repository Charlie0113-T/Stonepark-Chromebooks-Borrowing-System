/**
 * Bookings REST routes
 * GET    /api/bookings              - list all bookings (optional ?resourceId=, ?status=, ?search=, ?schoolId=)
 * GET    /api/bookings/:id          - get single booking
 * GET    /api/bookings/:id/qr       - get QR code PNG for check-in/check-out
 * POST   /api/bookings              - create booking (with conflict detection)
 * PATCH  /api/bookings/:id/return   - mark a booking as returned
 * PATCH  /api/bookings/:id/cancel   - cancel a booking
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { resourcesDB, bookingsDB } = require('../db/database');
const { checkConflictDB, isBookingOverdue } = require('../models/booking');
const { notifyBookingCreated, notifyBookingReturned } = require('../services/notifications');

module.exports = function createBookingsRouter() {
  const router = express.Router();

  // GET /api/bookings
  router.get('/', (req, res) => {
    const { resourceId, status, search, schoolId } = req.query;
    let result = bookingsDB.getAll({ resourceId, status, search, schoolId });

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
    const booking = bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: { ...booking, isOverdue: isBookingOverdue(booking) } });
  });

  // GET /api/bookings/:id/qr  – returns a PNG QR code for the booking
  router.get('/:id/qr', async (req, res) => {
    const booking = bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    try {
      const qrData = JSON.stringify({
        bookingId: booking.id,
        resourceId: booking.resourceId,
        borrower: booking.borrower,
        status: booking.status,
      });
      const format = req.query.format === 'svg' ? 'svg' : 'png';
      if (format === 'svg') {
        const svg = await QRCode.toString(qrData, { type: 'svg' });
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svg);
      }
      const buffer = await QRCode.toBuffer(qrData, { type: 'png', width: 300 });
      res.setHeader('Content-Type', 'image/png');
      res.send(buffer);
    } catch (err) {
      console.error('[QR] Generation failed:', err);
      res.status(500).json({ success: false, message: 'QR code generation failed.' });
    }
  });

  // POST /api/bookings - create new booking
  router.post('/', async (req, res) => {
    const { resourceId, borrower, borrowerClass, quantity, startTime, endTime, notes } = req.body;

    // Validate required fields
    if (!resourceId || !borrower || !borrowerClass || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'resourceId, borrower, borrowerClass, startTime and endTime are required.',
      });
    }

    const resource = resourcesDB.getById(resourceId);
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
    const conflict = checkConflictDB(resource, startTime, endTime, requestedQty);
    if (!conflict.ok) {
      return res.status(409).json({ success: false, message: conflict.reason });
    }

    const booking = bookingsDB.create({
      id: uuidv4(),
      resourceId,
      borrower,
      borrowerClass,
      quantity: requestedQty,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      actualReturnTime: null,
      status: 'active',
      notes: notes || '',
    });

    // Fire-and-forget notification
    notifyBookingCreated(booking, resource).catch(() => {});

    res.status(201).json({ success: true, data: booking });
  });

  // PATCH /api/bookings/:id/return
  router.patch('/:id/return', async (req, res) => {
    const booking = bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
    }
    const updated = bookingsDB.update(req.params.id, {
      status: 'returned',
      actualReturnTime: new Date().toISOString(),
    });

    // Fire-and-forget notification
    const resource = resourcesDB.getById(booking.resourceId);
    if (resource) notifyBookingReturned(updated, resource).catch(() => {});

    res.json({ success: true, data: updated });
  });

  // PATCH /api/bookings/:id/cancel
  router.patch('/:id/cancel', (req, res) => {
    const booking = bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
    }
    const updated = bookingsDB.update(req.params.id, { status: 'cancelled' });
    res.json({ success: true, data: updated });
  });

  return router;
};

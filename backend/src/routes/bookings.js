/**
 * Bookings REST routes
 * GET    /api/bookings              - list all bookings (optional ?resourceId=, ?status=, ?search=, ?schoolId=)
 * GET    /api/bookings/:id          - get single booking
 * GET    /api/bookings/:id/qr       - get QR code PNG for check-in/check-out
 * GET    /api/bookings/:id/return-via-qr - mark booking as returned via QR scan
 * POST   /api/bookings              - create booking (with conflict detection)
 * PATCH  /api/bookings/:id/return   - mark a booking as returned
 * PATCH  /api/bookings/:id/cancel   - cancel a booking
 */

const express = require('express');
const { randomUUID } = require('node:crypto');
const QRCode = require('qrcode');
const { resourcesDB, bookingsDB, usersDB } = require('../db/database');
const bcrypt = require('bcryptjs');
const { checkConflictDB, isBookingOverdue } = require('../models/booking');
const { notifyBookingCreated, notifyBookingReturned } = require('../services/notifications');

module.exports = function createBookingsRouter() {
  const router = express.Router();

  // GET /api/bookings
  router.get('/', async (req, res) => {
    const { resourceId, status, search, schoolId } = req.query;
    let result = await bookingsDB.getAll({ resourceId, status, search, schoolId });

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
  router.get('/:id', async (req, res) => {
    const booking = await bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: { ...booking, isOverdue: isBookingOverdue(booking) } });
  });

  // GET /api/bookings/:id/qr  – returns a PNG QR code for the booking
  router.get('/:id/qr', async (req, res) => {
    const booking = await bookingsDB.getById(req.params.id);
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

  // GET /api/bookings/:id/return-via-qr - show admin confirmation form
  router.get('/:id/return-via-qr', async (req, res) => {
    const booking = await bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).send('<h2>Booking not found.</h2>');
    }
    const statusMsg = booking.status === 'active'
      ? 'Admin confirmation required to return this booking.'
      : `Booking is already ${booking.status}.`;

    return res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Return Booking</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; max-width: 520px; margin: 0 auto; }
            .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; }
            label { display: block; font-size: 14px; margin-top: 12px; }
            input { width: 100%; padding: 10px; margin-top: 6px; box-sizing: border-box; }
            button { width: 100%; padding: 12px; margin-top: 16px; background: #333; color: #fff; border: none; border-radius: 6px; }
          </style>
        </head>
        <body>
          <h2>Return Booking</h2>
          <p>${statusMsg}</p>
          <div class="card">
            <form method="POST" action="/api/bookings/${booking.id}/return-via-qr">
              <label for="email">Admin Email</label>
              <input id="email" name="email" type="email" required />
              <label for="password">Admin Password</label>
              <input id="password" name="password" type="password" required />
              <button type="submit">Confirm Return</button>
            </form>
          </div>
        </body>
      </html>
    `);
  });

  // POST /api/bookings/:id/return-via-qr - admin confirmation and return
  router.post('/:id/return-via-qr', async (req, res) => {
    const booking = await bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).send('<h2>Booking not found.</h2>');
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('<h2>Email and password are required.</h2>');
    }

    const user = await usersDB.getByEmail(email);
    if (!user || user.role !== 'admin' || !user.password_hash) {
      return res.status(403).send('<h2>Admin access required.</h2>');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).send('<h2>Invalid credentials.</h2>');
    }

    if (booking.status !== 'active') {
      return res.send(`<h2>No action needed.</h2><p>Booking ${booking.id} is already ${booking.status}.</p>`);
    }

    const updated = await bookingsDB.update(req.params.id, {
      status: 'returned',
      actualReturnTime: new Date().toISOString(),
    });
    const resource = await resourcesDB.getById(booking.resourceId);
    if (resource) notifyBookingReturned(updated, resource).catch(() => {});

    return res.send(
      `<h2>Return successful.</h2><p>Booking ${updated.id} has been marked as returned.</p>`
    );
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

    const resource = await resourcesDB.getById(resourceId);
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
    const conflict = await checkConflictDB(resource, startTime, endTime, requestedQty);
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
      status: 'active',
      notes: notes || '',
    });

    // Fire-and-forget notification
    notifyBookingCreated(booking, resource).catch(() => {});

    res.status(201).json({ success: true, data: booking });
  });

  // PATCH /api/bookings/:id/return
  router.patch('/:id/return', async (req, res) => {
    const booking = await bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
    }
    const updated = await bookingsDB.update(req.params.id, {
      status: 'returned',
      actualReturnTime: new Date().toISOString(),
    });

    // Fire-and-forget notification
    const resource = await resourcesDB.getById(booking.resourceId);
    if (resource) notifyBookingReturned(updated, resource).catch(() => {});

    res.json({ success: true, data: updated });
  });

  // PATCH /api/bookings/:id/cancel
  router.patch('/:id/cancel', async (req, res) => {
    const booking = await bookingsDB.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
    }
    const updated = await bookingsDB.update(req.params.id, { status: 'cancelled' });
    res.json({ success: true, data: updated });
  });

  return router;
};

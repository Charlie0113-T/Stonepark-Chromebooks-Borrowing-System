/**
 * Resources REST routes
 * GET  /api/resources        - list all resources with current status
 * GET  /api/resources/:id    - get single resource
 * POST /api/resources        - create a new resource
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { resources, RESOURCE_TYPE, bookings: storeBookings, BOOKING_STATUS } = require('../data/store');
const { enrichResource, getBookedQuantity } = require('../models/booking');

// bookings array is passed in so routes always use the shared mutable reference
module.exports = function createResourcesRouter(bookings) {
  const router = express.Router();

  // GET /api/resources
  router.get('/', (req, res) => {
    const enriched = resources.map((r) => enrichResource(r, bookings));
    res.json({ success: true, data: enriched });
  });

  // GET /api/resources/:id
  router.get('/:id', (req, res) => {
    const resource = resources.find((r) => r.id === req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    res.json({ success: true, data: enrichResource(resource, bookings) });
  });

  // POST /api/resources
  router.post('/', (req, res) => {
    const { type, name, classRoom, totalQuantity, description } = req.body;

    if (!type || !name || !classRoom || totalQuantity == null) {
      return res.status(400).json({ success: false, message: 'type, name, classRoom and totalQuantity are required.' });
    }
    if (!Object.values(RESOURCE_TYPE).includes(type)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${Object.values(RESOURCE_TYPE).join(', ')}` });
    }
    const qty = parseInt(totalQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'totalQuantity must be a positive integer.' });
    }
    if (type === RESOURCE_TYPE.SINGLE && qty !== 1) {
      return res.status(400).json({ success: false, message: 'Single-device resources must have totalQuantity of 1.' });
    }

    const resource = {
      id: uuidv4(),
      type,
      name,
      classRoom,
      totalQuantity: qty,
      description: description || '',
    };
    resources.push(resource);
    res.status(201).json({ success: true, data: enrichResource(resource, bookings) });
  });

  // PUT /api/resources/:id
  router.put('/:id', (req, res) => {
    const idx = resources.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    const resource = resources[idx];
    const { name, classRoom, description, totalQuantity } = req.body;

    if (name != null) resource.name = name;
    if (classRoom != null) resource.classRoom = classRoom;
    if (description != null) resource.description = description;
    if (totalQuantity != null) {
      const qty = parseInt(totalQuantity, 10);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ success: false, message: 'totalQuantity must be a positive integer.' });
      }
      if (resource.type === RESOURCE_TYPE.SINGLE && qty !== 1) {
        return res.status(400).json({ success: false, message: 'Single-device resources must have totalQuantity of 1.' });
      }
      const now = new Date().toISOString();
      const currentBooked = getBookedQuantity(bookings, resource.id, now, now);
      if (qty < currentBooked) {
        return res.status(409).json({
          success: false,
          message: `Cannot reduce totalQuantity to ${qty}; ${currentBooked} units are currently booked.`,
        });
      }
      resource.totalQuantity = qty;
    }

    res.json({ success: true, data: enrichResource(resource, bookings) });
  });

  // DELETE /api/resources/:id
  router.delete('/:id', (req, res) => {
    const idx = resources.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    const hasActive = storeBookings.some(
      (b) => b.resourceId === req.params.id && b.status === BOOKING_STATUS.ACTIVE
    );
    if (hasActive) {
      return res.status(409).json({ success: false, message: 'Cannot delete resource with active bookings.' });
    }

    resources.splice(idx, 1);
    res.json({ success: true, message: 'Resource deleted.' });
  });

  return router;
};

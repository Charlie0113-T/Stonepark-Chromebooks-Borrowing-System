/**
 * Resources REST routes
 * GET    /api/resources        - list all resources with current status (?schoolId=)
 * GET    /api/resources/:id    - get single resource
 * POST   /api/resources        - create a new resource
 * PUT    /api/resources/:id    - update a resource
 * DELETE /api/resources/:id    - delete a resource (blocked if active bookings)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { resourcesDB, bookingsDB } = require('../db/database');
const { enrichResourceDB, getBookedQuantityDB } = require('../models/booking');

const RESOURCE_TYPE = { CABINET: 'cabinet', SINGLE: 'single' };

module.exports = function createResourcesRouter() {
  const router = express.Router();

  // GET /api/resources
  router.get('/', (req, res) => {
    const resources = resourcesDB.getAll(req.query.schoolId);
    const enriched = resources.map((r) => enrichResourceDB(r));
    res.json({ success: true, data: enriched });
  });

  // GET /api/resources/:id
  router.get('/:id', (req, res) => {
    const resource = resourcesDB.getById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    res.json({ success: true, data: enrichResourceDB(resource) });
  });

  // POST /api/resources
  router.post('/', (req, res) => {
    const { type, name, classRoom, totalQuantity, description, schoolId } = req.body;

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

    const resource = resourcesDB.create({
      id: uuidv4(),
      type,
      name,
      classRoom,
      totalQuantity: qty,
      description: description || '',
      schoolId: schoolId || 'school-default',
    });
    res.status(201).json({ success: true, data: enrichResourceDB(resource) });
  });

  // PUT /api/resources/:id
  router.put('/:id', (req, res) => {
    const resource = resourcesDB.getById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    const { name, classRoom, description, totalQuantity } = req.body;
    const updates = {};

    if (name != null) updates.name = name;
    if (classRoom != null) updates.classRoom = classRoom;
    if (description != null) updates.description = description;
    if (totalQuantity != null) {
      const qty = parseInt(totalQuantity, 10);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ success: false, message: 'totalQuantity must be a positive integer.' });
      }
      if (resource.type === RESOURCE_TYPE.SINGLE && qty !== 1) {
        return res.status(400).json({ success: false, message: 'Single-device resources must have totalQuantity of 1.' });
      }
      const now = new Date().toISOString();
      const currentBooked = getBookedQuantityDB(resource.id, now, now);
      if (qty < currentBooked) {
        return res.status(409).json({
          success: false,
          message: `Cannot reduce totalQuantity to ${qty}; ${currentBooked} units are currently booked.`,
        });
      }
      updates.totalQuantity = qty;
    }

    const updated = resourcesDB.update(req.params.id, updates);
    res.json({ success: true, data: enrichResourceDB(updated) });
  });

  // DELETE /api/resources/:id
  router.delete('/:id', (req, res) => {
    const resource = resourcesDB.getById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    if (resourcesDB.hasActiveBookings(req.params.id)) {
      return res.status(409).json({ success: false, message: 'Cannot delete resource with active bookings.' });
    }
    resourcesDB.delete(req.params.id);
    res.json({ success: true, message: 'Resource deleted.' });
  });

  return router;
};

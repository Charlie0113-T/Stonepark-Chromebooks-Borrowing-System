/**
 * Resources REST routes
 * GET  /api/resources        - list all resources with current status
 * GET  /api/resources/:id    - get single resource
 * POST /api/resources        - create a new resource
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { resources, RESOURCE_TYPE } = require('../data/store');
const { enrichResource } = require('../models/booking');

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

  return router;
};

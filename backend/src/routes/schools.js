/**
 * Schools / campuses REST routes
 * GET  /api/schools         - list all schools
 * GET  /api/schools/:id     - get single school
 * POST /api/schools         - create a new school (admin only)
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('node:crypto');
const { schoolsDB } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// 30 create-school requests per 15 minutes per IP
const createSchoolLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

module.exports = function createSchoolsRouter() {
  const router = express.Router();

  // GET /api/schools
  router.get('/', async (req, res) => {
    res.json({ success: true, data: await schoolsDB.getAll() });
  });

  // GET /api/schools/:id
  router.get('/:id', async (req, res) => {
    const school = await schoolsDB.getById(req.params.id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }
    res.json({ success: true, data: school });
  });

  // POST /api/schools  – create a new school/campus
  router.post('/', createSchoolLimiter, requireAuth, requireAdmin, async (req, res) => {
    const { name, campus } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }
    const school = await schoolsDB.create({ id: randomUUID(), name, campus: campus || 'Main Campus' });
    res.status(201).json({ success: true, data: school });
  });

  return router;
};

/**
 * Schools / campuses REST routes
 * GET  /api/schools         - list all schools
 * GET  /api/schools/:id     - get single school
 * POST /api/schools         - create a new school (admin only)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { schoolsDB } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

module.exports = function createSchoolsRouter() {
  const router = express.Router();

  // GET /api/schools
  router.get('/', (req, res) => {
    res.json({ success: true, data: schoolsDB.getAll() });
  });

  // GET /api/schools/:id
  router.get('/:id', (req, res) => {
    const school = schoolsDB.getById(req.params.id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }
    res.json({ success: true, data: school });
  });

  // POST /api/schools  – create a new school/campus
  router.post('/', requireAuth, requireAdmin, (req, res) => {
    const { name, campus } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }
    const school = schoolsDB.create({ id: uuidv4(), name, campus: campus || 'Main Campus' });
    res.status(201).json({ success: true, data: school });
  });

  return router;
};

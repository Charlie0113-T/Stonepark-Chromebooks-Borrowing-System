const express = require('express');
const cors = require('cors');

// Database initialised on require (runs migrations + seed)
require('./src/db/database');

const createResourcesRouter = require('./src/routes/resources');
const createBookingsRouter = require('./src/routes/bookings');
const createStatsRouter = require('./src/routes/stats');
const createAuthRouter = require('./src/routes/auth');
const createSchoolsRouter = require('./src/routes/schools');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', createAuthRouter());
app.use('/api/schools', createSchoolsRouter());
app.use('/api/resources', createResourcesRouter());
app.use('/api/bookings', createBookingsRouter());
app.use('/api/stats', createStatsRouter());

// Health-check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Stonepark Intermediate School Chromebook API running on http://localhost:${PORT}`);
});

module.exports = app;

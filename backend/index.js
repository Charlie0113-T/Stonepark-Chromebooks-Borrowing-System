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

function parseCorsOrigins(value) {
  if (!value) return null;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser requests (curl, health checks, server-to-server).
    if (!origin) return callback(null, true);

    if (!allowedOrigins || allowedOrigins.length === 0) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

// ── Middleware ────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', createAuthRouter());
app.use('/api/schools', createSchoolsRouter());
app.use('/api/resources', createResourcesRouter());
app.use('/api/bookings', createBookingsRouter());
app.use('/api/stats', createStatsRouter());

// Health-check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Stonepark Intermediate School Chromebook API running on http://localhost:${PORT}`);
  });
}

module.exports = app;

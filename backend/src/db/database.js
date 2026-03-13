/**
 * SQLite database setup using better-sqlite3.
 * Provides persistent storage that can be swapped for PostgreSQL
 * by replacing this module with a pg-based adapter.
 *
 * For PostgreSQL, set DATABASE_URL in your .env and swap the driver.
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'chromebook.db');

// Ensure the data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    campus TEXT NOT NULL DEFAULT 'Main Campus',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'school-default',
    type TEXT NOT NULL CHECK(type IN ('cabinet', 'single')),
    name TEXT NOT NULL,
    class_room TEXT NOT NULL,
    total_quantity INTEGER NOT NULL CHECK(total_quantity >= 1),
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    borrower TEXT NOT NULL,
    borrower_class TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    actual_return_time TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'returned', 'cancelled')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (resource_id) REFERENCES resources(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'school-default',
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'staff')),
    google_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (school_id) REFERENCES schools(id)
  );
`);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Converts a SQLite resource row to the API shape expected by the frontend.
 */
function rowToResource(row) {
  return {
    id: row.id,
    schoolId: row.school_id,
    type: row.type,
    name: row.name,
    classRoom: row.class_room,
    totalQuantity: row.total_quantity,
    description: row.description,
  };
}

/**
 * Converts a SQLite booking row to the API shape expected by the frontend.
 */
function rowToBooking(row) {
  return {
    id: row.id,
    resourceId: row.resource_id,
    borrower: row.borrower,
    borrowerClass: row.borrower_class,
    quantity: row.quantity,
    startTime: row.start_time,
    endTime: row.end_time,
    actualReturnTime: row.actual_return_time || null,
    status: row.status,
    notes: row.notes,
  };
}

// ── Resources ──────────────────────────────────────────────────────────────

const resourcesDB = {
  getAll(schoolId) {
    if (schoolId) {
      return db.prepare('SELECT * FROM resources WHERE school_id = ? ORDER BY name').all(schoolId).map(rowToResource);
    }
    return db.prepare('SELECT * FROM resources ORDER BY name').all().map(rowToResource);
  },

  getById(id) {
    const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
    return row ? rowToResource(row) : null;
  },

  create(resource) {
    db.prepare(
      `INSERT INTO resources (id, school_id, type, name, class_room, total_quantity, description)
       VALUES (@id, @schoolId, @type, @name, @classRoom, @totalQuantity, @description)`
    ).run({
      id: resource.id,
      schoolId: resource.schoolId || 'school-default',
      type: resource.type,
      name: resource.name,
      classRoom: resource.classRoom,
      totalQuantity: resource.totalQuantity,
      description: resource.description || '',
    });
    return this.getById(resource.id);
  },

  update(id, fields) {
    const resource = this.getById(id);
    if (!resource) return null;
    const updated = { ...resource, ...fields };
    db.prepare(
      `UPDATE resources SET name = @name, class_room = @classRoom,
       total_quantity = @totalQuantity, description = @description WHERE id = @id`
    ).run({
      id,
      name: updated.name,
      classRoom: updated.classRoom,
      totalQuantity: updated.totalQuantity,
      description: updated.description,
    });
    return this.getById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  },

  hasActiveBookings(id) {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM bookings WHERE resource_id = ? AND status = 'active'"
    ).get(id);
    return row.cnt > 0;
  },
};

// ── Bookings ───────────────────────────────────────────────────────────────

const bookingsDB = {
  getAll({ resourceId, status, search, schoolId } = {}) {
    let query = 'SELECT b.* FROM bookings b';
    const params = [];
    const conditions = [];

    if (schoolId) {
      query += ' JOIN resources r ON b.resource_id = r.id';
      conditions.push('r.school_id = ?');
      params.push(schoolId);
    }
    if (resourceId) {
      conditions.push('b.resource_id = ?');
      params.push(resourceId);
    }
    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(LOWER(b.borrower) LIKE ? OR LOWER(b.borrower_class) LIKE ?)');
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY b.start_time DESC';
    return db.prepare(query).all(...params).map(rowToBooking);
  },

  getById(id) {
    const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    return row ? rowToBooking(row) : null;
  },

  create(booking) {
    db.prepare(
      `INSERT INTO bookings (id, resource_id, borrower, borrower_class, quantity,
       start_time, end_time, actual_return_time, status, notes)
       VALUES (@id, @resourceId, @borrower, @borrowerClass, @quantity,
       @startTime, @endTime, @actualReturnTime, @status, @notes)`
    ).run({
      id: booking.id,
      resourceId: booking.resourceId,
      borrower: booking.borrower,
      borrowerClass: booking.borrowerClass,
      quantity: booking.quantity,
      startTime: booking.startTime,
      endTime: booking.endTime,
      actualReturnTime: booking.actualReturnTime || null,
      status: booking.status,
      notes: booking.notes || '',
    });
    return this.getById(booking.id);
  },

  update(id, fields) {
    const booking = this.getById(id);
    if (!booking) return null;
    const updated = { ...booking, ...fields };
    db.prepare(
      `UPDATE bookings SET status = @status, actual_return_time = @actualReturnTime WHERE id = @id`
    ).run({
      id,
      status: updated.status,
      actualReturnTime: updated.actualReturnTime || null,
    });
    return this.getById(id);
  },

  getOverlapping(resourceId, startTime, endTime, excludeId = null) {
    let query = `
      SELECT * FROM bookings
      WHERE resource_id = ? AND status = 'active'
      AND NOT (end_time <= ? OR start_time >= ?)
    `;
    const params = [resourceId, startTime, endTime];
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    return db.prepare(query).all(...params).map(rowToBooking);
  },
};

// ── Schools ────────────────────────────────────────────────────────────────

const schoolsDB = {
  getAll() {
    return db.prepare('SELECT * FROM schools ORDER BY name').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM schools WHERE id = ?').get(id);
  },

  create(school) {
    db.prepare(
      'INSERT INTO schools (id, name, campus) VALUES (@id, @name, @campus)'
    ).run(school);
    return this.getById(school.id);
  },
};

// ── Seed ───────────────────────────────────────────────────────────────────

function seed() {
  const { v4: uuidv4 } = require('uuid');

  // Only seed if empty
  const schoolCount = db.prepare('SELECT COUNT(*) as cnt FROM schools').get().cnt;
  if (schoolCount > 0) return;

  // Default school
  schoolsDB.create({ id: 'school-default', name: 'Stonepark Intermediate School', campus: 'Main Campus' });

  const seedResources = [
    { id: 'res-001', type: 'cabinet', name: 'Cabinet A', classRoom: 'Room 101', totalQuantity: 30, description: 'Year 7 charging cabinet' },
    { id: 'res-002', type: 'cabinet', name: 'Cabinet B', classRoom: 'Room 102', totalQuantity: 30, description: 'Year 8 charging cabinet' },
    { id: 'res-003', type: 'cabinet', name: 'Cabinet C', classRoom: 'Room 103', totalQuantity: 20, description: 'Science department shared cabinet' },
    { id: 'res-004', type: 'cabinet', name: 'Cabinet D', classRoom: 'Room 201', totalQuantity: 25, description: 'Digital Arts classroom cabinet' },
    { id: 'res-005', type: 'single', name: 'Chromebook #001', classRoom: 'Library', totalQuantity: 1, description: 'Library Chromebook for student research' },
    { id: 'res-006', type: 'single', name: 'Chromebook #002', classRoom: 'Library', totalQuantity: 1, description: 'Library Chromebook for student research' },
    { id: 'res-007', type: 'single', name: 'Chromebook #003', classRoom: 'Staff Room', totalQuantity: 1, description: 'Staff shared Chromebook' },
    { id: 'res-008', type: 'single', name: 'Chromebook #004', classRoom: 'Reception', totalQuantity: 1, description: 'Front desk Chromebook for visitor sign-in' },
    { id: 'res-009', type: 'single', name: 'Chromebook #005', classRoom: 'Room 105', totalQuantity: 1, description: 'ESOL support Chromebook' },
  ];

  for (const r of seedResources) {
    resourcesDB.create({ ...r, schoolId: 'school-default' });
  }

  const now = new Date();
  const seedBookings = [
    {
      resourceId: 'res-001', borrower: 'Ms. Johnson', borrowerClass: 'Year 7', quantity: 15,
      startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'active', notes: 'Year 7 Science project',
    },
    {
      resourceId: 'res-002', borrower: 'Mr. Smith', borrowerClass: 'Year 8', quantity: 30,
      startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
      status: 'active', notes: 'Year 8 Digital Literacy exam',
    },
    {
      resourceId: 'res-005', borrower: 'Alice Chen', borrowerClass: 'Year 9', quantity: 1,
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      actualReturnTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      status: 'returned', notes: 'Independent research',
    },
    {
      resourceId: 'res-003', borrower: 'Mrs. Williams', borrowerClass: 'Year 9', quantity: 10,
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      status: 'active', notes: 'Year 9 Geography mapping exercise',
    },
    {
      resourceId: 'res-004', borrower: 'Mr. Patel', borrowerClass: 'Year 10', quantity: 20,
      startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      status: 'active', notes: 'Digital Arts portfolio work',
    },
    {
      resourceId: 'res-007', borrower: 'Sarah Kim', borrowerClass: 'Staff', quantity: 1,
      startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      status: 'active', notes: 'Staff meeting notes',
    },
    {
      resourceId: 'res-001', borrower: 'Ms. Brown', borrowerClass: 'Year 7', quantity: 10,
      startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      actualReturnTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'returned', notes: 'Maths assessment completed',
    },
    {
      resourceId: 'res-009', borrower: 'Jake Thompson', borrowerClass: 'Year 8', quantity: 1,
      startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'cancelled', notes: 'Cancelled - student absent',
    },
  ];

  for (const b of seedBookings) {
    bookingsDB.create({ id: uuidv4(), actualReturnTime: null, ...b });
  }
}

seed();

module.exports = { db, resourcesDB, bookingsDB, schoolsDB };

/**
 * Database adapter.
 *
 * - Uses PostgreSQL when DATABASE_URL is set (recommended for production/serverless).
 * - Falls back to SQLite for local development when DATABASE_URL is absent.
 */

const path = require('path');
const fs = require('fs');

const USE_POSTGRES = !!process.env.DATABASE_URL;

let pgPool = null;
let sqlite = null;

let initPromise = null;

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

function buildSeedResources() {
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

  // Requirement: G7-G9 each grade should have at least 5 charging stations.
  for (const grade of ['G7', 'G8', 'G9']) {
    for (let i = 1; i <= 5; i += 1) {
      seedResources.push({
        id: `res-${grade.toLowerCase()}-cab-${i}`,
        type: 'cabinet',
        name: `${grade} Charging Bay ${i}`,
        classRoom: `${grade} Learning Hub ${i}`,
        totalQuantity: 30,
        description: `${grade} dedicated charging cabinet`,
      });
    }
  }

  return seedResources;
}

function buildGradeCabinets(grade) {
  const items = [];
  for (let i = 1; i <= 5; i += 1) {
    items.push({
      id: `res-${grade.toLowerCase()}-cab-${i}`,
      type: 'cabinet',
      name: `${grade} Charging Bay ${i}`,
      classRoom: `${grade} Learning Hub ${i}`,
      totalQuantity: 30,
      description: `${grade} dedicated charging cabinet`,
      schoolId: 'school-default',
    });
  }
  return items;
}

async function ensureMinimumGradeChargingBays() {
  await ensureInit();

  for (const grade of ['G7', 'G8', 'G9']) {
    const candidates = buildGradeCabinets(grade);

    if (USE_POSTGRES) {
      const countResult = await pgPool.query(
        `SELECT COUNT(*)::int as cnt
         FROM resources
         WHERE type = 'cabinet' AND name LIKE $1`,
        [`${grade} Charging Bay %`]
      );
      const existingCount = countResult.rows[0].cnt;
      if (existingCount >= 5) continue;

      for (const item of candidates) {
        await pgPool.query(
          `INSERT INTO resources (id, school_id, type, name, class_room, total_quantity, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [item.id, item.schoolId, item.type, item.name, item.classRoom, item.totalQuantity, item.description]
        );
      }
      continue;
    }

    const existingCount = sqlite.prepare(
      `SELECT COUNT(*) as cnt FROM resources WHERE type = 'cabinet' AND name LIKE ?`
    ).get(`${grade} Charging Bay %`).cnt;

    if (existingCount >= 5) continue;

    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO resources (id, school_id, type, name, class_room, total_quantity, description)
       VALUES (@id, @schoolId, @type, @name, @classRoom, @totalQuantity, @description)`
    );

    for (const item of candidates) {
      insert.run(item);
    }
  }
}

function buildSeedBookings() {
  const now = new Date();
  return [
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
      resourceId: 'res-g7-cab-1', borrower: 'Mrs. Williams', borrowerClass: 'Year 9', quantity: 10,
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      status: 'active', notes: 'Geography mapping exercise',
    },
    {
      resourceId: 'res-g8-cab-2', borrower: 'Mr. Patel', borrowerClass: 'Year 10', quantity: 20,
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
}

async function initPostgres() {
  const { Pool } = require('pg');

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      campus TEXT NOT NULL DEFAULT 'Main Campus',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL DEFAULT 'school-default',
      type TEXT NOT NULL CHECK(type IN ('cabinet', 'single')),
      name TEXT NOT NULL,
      class_room TEXT NOT NULL,
      total_quantity INTEGER NOT NULL CHECK(total_quantity >= 1),
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (resource_id) REFERENCES resources(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL DEFAULT 'school-default',
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'staff')),
      google_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );
  `);

  const schoolCount = await pgPool.query('SELECT COUNT(*)::int as cnt FROM schools');
  if (schoolCount.rows[0].cnt > 0) return;

  await schoolsDB.create({ id: 'school-default', name: 'Stonepark Intermediate School', campus: 'Main Campus' });

  for (const r of buildSeedResources()) {
    await resourcesDB.create({ ...r, schoolId: 'school-default' });
  }

  const { randomUUID } = require('node:crypto');
  for (const b of buildSeedBookings()) {
    await bookingsDB.create({ id: randomUUID(), actualReturnTime: null, ...b });
  }
}

function initSqlite() {
  const Database = require('better-sqlite3');

  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'chromebook.db');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
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
}

async function seedSqliteIfEmpty() {
  const schoolCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM schools').get().cnt;
  if (schoolCount > 0) return;

  await schoolsDB.create({ id: 'school-default', name: 'Stonepark Intermediate School', campus: 'Main Campus' });

  for (const r of buildSeedResources()) {
    await resourcesDB.create({ ...r, schoolId: 'school-default' });
  }

  const { randomUUID } = require('node:crypto');
  for (const b of buildSeedBookings()) {
    await bookingsDB.create({ id: randomUUID(), actualReturnTime: null, ...b });
  }
}

async function ensureInit() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (USE_POSTGRES) {
      await initPostgres();
      return;
    }

    initSqlite();
    await seedSqliteIfEmpty();
  })();

  return initPromise;
}

const resourcesDB = {
  async getAll(schoolId) {
    await ensureInit();

    if (USE_POSTGRES) {
      if (schoolId) {
        const result = await pgPool.query('SELECT * FROM resources WHERE school_id = $1 ORDER BY name', [schoolId]);
        return result.rows.map(rowToResource);
      }
      const result = await pgPool.query('SELECT * FROM resources ORDER BY name');
      return result.rows.map(rowToResource);
    }

    if (schoolId) {
      return sqlite.prepare('SELECT * FROM resources WHERE school_id = ? ORDER BY name').all(schoolId).map(rowToResource);
    }
    return sqlite.prepare('SELECT * FROM resources ORDER BY name').all().map(rowToResource);
  },

  async getById(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query('SELECT * FROM resources WHERE id = $1', [id]);
      return result.rows[0] ? rowToResource(result.rows[0]) : null;
    }

    const row = sqlite.prepare('SELECT * FROM resources WHERE id = ?').get(id);
    return row ? rowToResource(row) : null;
  },

  async create(resource) {
    await ensureInit();

    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO resources (id, school_id, type, name, class_room, total_quantity, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          resource.id,
          resource.schoolId || 'school-default',
          resource.type,
          resource.name,
          resource.classRoom,
          resource.totalQuantity,
          resource.description || '',
        ]
      );
      return this.getById(resource.id);
    }

    sqlite.prepare(
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

  async update(id, fields) {
    const resource = await this.getById(id);
    if (!resource) return null;

    const updated = { ...resource, ...fields };

    if (USE_POSTGRES) {
      await pgPool.query(
        `UPDATE resources
         SET name = $1, class_room = $2, total_quantity = $3, description = $4
         WHERE id = $5`,
        [updated.name, updated.classRoom, updated.totalQuantity, updated.description, id]
      );
      return this.getById(id);
    }

    sqlite.prepare(
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

  async delete(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      await pgPool.query('DELETE FROM resources WHERE id = $1', [id]);
      return;
    }

    sqlite.prepare('DELETE FROM resources WHERE id = ?').run(id);
  },

  async hasActiveBookings(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT COUNT(*)::int as cnt FROM bookings WHERE resource_id = $1 AND status = 'active'",
        [id]
      );
      return result.rows[0].cnt > 0;
    }

    const row = sqlite.prepare("SELECT COUNT(*) as cnt FROM bookings WHERE resource_id = ? AND status = 'active'").get(id);
    return row.cnt > 0;
  },
};

const bookingsDB = {
  async getAll({ resourceId, status, search, schoolId } = {}) {
    await ensureInit();

    if (USE_POSTGRES) {
      let query = 'SELECT b.* FROM bookings b';
      const params = [];
      const conditions = [];

      if (schoolId) {
        query += ' JOIN resources r ON b.resource_id = r.id';
        params.push(schoolId);
        conditions.push(`r.school_id = $${params.length}`);
      }
      if (resourceId) {
        params.push(resourceId);
        conditions.push(`b.resource_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`b.status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        params.push(`%${search.toLowerCase()}%`);
        const a = `$${params.length - 1}`;
        const b = `$${params.length}`;
        conditions.push(`(LOWER(b.borrower) LIKE ${a} OR LOWER(b.borrower_class) LIKE ${b})`);
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ' ORDER BY b.start_time DESC';

      const result = await pgPool.query(query, params);
      return result.rows.map(rowToBooking);
    }

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

    return sqlite.prepare(query).all(...params).map(rowToBooking);
  },

  async getById(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query('SELECT * FROM bookings WHERE id = $1', [id]);
      return result.rows[0] ? rowToBooking(result.rows[0]) : null;
    }

    const row = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    return row ? rowToBooking(row) : null;
  },

  async create(booking) {
    await ensureInit();

    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO bookings (id, resource_id, borrower, borrower_class, quantity,
         start_time, end_time, actual_return_time, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          booking.id,
          booking.resourceId,
          booking.borrower,
          booking.borrowerClass,
          booking.quantity,
          booking.startTime,
          booking.endTime,
          booking.actualReturnTime || null,
          booking.status,
          booking.notes || '',
        ]
      );
      return this.getById(booking.id);
    }

    sqlite.prepare(
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

  async update(id, fields) {
    const booking = await this.getById(id);
    if (!booking) return null;

    const updated = { ...booking, ...fields };

    if (USE_POSTGRES) {
      await pgPool.query(
        `UPDATE bookings SET status = $1, actual_return_time = $2 WHERE id = $3`,
        [updated.status, updated.actualReturnTime || null, id]
      );
      return this.getById(id);
    }

    sqlite.prepare(
      `UPDATE bookings SET status = @status, actual_return_time = @actualReturnTime WHERE id = @id`
    ).run({
      id,
      status: updated.status,
      actualReturnTime: updated.actualReturnTime || null,
    });
    return this.getById(id);
  },

  async getOverlapping(resourceId, startTime, endTime, excludeId = null) {
    await ensureInit();

    if (USE_POSTGRES) {
      let query = `
        SELECT * FROM bookings
        WHERE resource_id = $1 AND status = 'active'
        AND NOT (end_time <= $2 OR start_time >= $3)
      `;
      const params = [resourceId, startTime, endTime];
      if (excludeId) {
        params.push(excludeId);
        query += ` AND id != $${params.length}`;
      }
      const result = await pgPool.query(query, params);
      return result.rows.map(rowToBooking);
    }

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
    return sqlite.prepare(query).all(...params).map(rowToBooking);
  },
};

const schoolsDB = {
  async getAll() {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query('SELECT * FROM schools ORDER BY name');
      return result.rows;
    }

    return sqlite.prepare('SELECT * FROM schools ORDER BY name').all();
  },

  async getById(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query('SELECT * FROM schools WHERE id = $1', [id]);
      return result.rows[0] || null;
    }

    return sqlite.prepare('SELECT * FROM schools WHERE id = ?').get(id) || null;
  },

  async create(school) {
    await ensureInit();

    if (USE_POSTGRES) {
      await pgPool.query('INSERT INTO schools (id, name, campus) VALUES ($1, $2, $3)', [school.id, school.name, school.campus]);
      return this.getById(school.id);
    }

    sqlite.prepare('INSERT INTO schools (id, name, campus) VALUES (@id, @name, @campus)').run(school);
    return this.getById(school.id);
  },
};

ensureInit().catch((err) => {
  console.error('[DB] Initialization failed:', err);
});

ensureMinimumGradeChargingBays().catch((err) => {
  console.error('[DB] Grade charging-bay backfill failed:', err);
});

module.exports = {
  resourcesDB,
  bookingsDB,
  schoolsDB,
  ready: ensureInit,
};

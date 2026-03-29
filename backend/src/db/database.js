/**
 * Database adapter.
 *
 * - Uses PostgreSQL when DATABASE_URL is set (recommended for production/serverless).
 * - Falls back to SQLite for local development when DATABASE_URL is absent.
 */

const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const USE_POSTGRES = !!process.env.DATABASE_URL;

let pgPool = null;
let sqlite = null;

let initPromise = null;

const LEGACY_CABINET_IDS = ["res-001", "res-002", "res-003", "res-004"];
const LEGACY_CABINET_NAMES = [
  "Cabinet A",
  "Cabinet B",
  "Cabinet C",
  "Cabinet D",
  "Cabinet D2",
];

// Default whitelist emails are no longer hardcoded in source code for privacy.
// Use the WHITELIST_SEED environment variable to provide initial whitelist emails.
const DEFAULT_WHITELIST_EMAILS = [];

function parseAdminUsers() {
  const raw = (process.env.ADMIN_USERS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, password] = entry.split(":");
      return {
        email: (email || "").trim().toLowerCase(),
        password: (password || "").trim(),
      };
    })
    .filter((u) => u.email && u.password);
}

function parseStaffUsers() {
  const raw = (process.env.STAFF_USERS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      // Support both "email:password" and "Name:email:password"
      const parts = entry.split(":");
      const email = parts.length >= 3 ? parts[1] : parts[0];
      const password = parts[parts.length - 1];
      const name = parts.length >= 3 ? parts[0] : null;
      return {
        email: (email || "").trim().toLowerCase(),
        password: (password || "").trim(),
        name: (name || "").trim() || null,
      };
    })
    .filter((u) => u.email && u.password);
}

function parseWhitelistSeed() {
  const raw = (process.env.WHITELIST_SEED || "").trim();
  const list = raw
    ? raw
        .split(/[,\s]+/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : [];
  return Array.from(new Set(list));
}

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
    {
      id: "res-005",
      type: "single",
      name: "Chromebook #001",
      classRoom: "Library",
      totalQuantity: 1,
      description: "Library Chromebook for student research",
    },
    {
      id: "res-006",
      type: "single",
      name: "Chromebook #002",
      classRoom: "Library",
      totalQuantity: 1,
      description: "Library Chromebook for student research",
    },
    {
      id: "res-007",
      type: "single",
      name: "Chromebook #003",
      classRoom: "Staff Room",
      totalQuantity: 1,
      description: "Staff shared Chromebook",
    },
    {
      id: "res-008",
      type: "single",
      name: "Chromebook #004",
      classRoom: "Reception",
      totalQuantity: 1,
      description: "Front desk Chromebook for visitor sign-in",
    },
    {
      id: "res-009",
      type: "single",
      name: "Chromebook #005",
      classRoom: "Reception",
      totalQuantity: 1,
      description: "Front desk Chromebook for visitor sign-in",
    },
  ];

  // Requirement: G7-G9 each grade should have at least 5 charging stations.
  for (const grade of ["G7", "G8", "G9"]) {
    for (let i = 1; i <= 5; i += 1) {
      seedResources.push({
        id: `res-${grade.toLowerCase()}-cab-${i}`,
        type: "cabinet",
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
      type: "cabinet",
      name: `${grade} Charging Bay ${i}`,
      classRoom: `${grade} Learning Hub ${i}`,
      totalQuantity: 30,
      description: `${grade} dedicated charging cabinet`,
      schoolId: "school-default",
    });
  }
  return items;
}

async function ensureMinimumGradeChargingBays() {
  await ensureInit();

  for (const grade of ["G7", "G8", "G9"]) {
    const candidates = buildGradeCabinets(grade);

    if (USE_POSTGRES) {
      const countResult = await pgPool.query(
        `SELECT COUNT(*)::int as cnt
         FROM resources
         WHERE type = 'cabinet' AND name LIKE $1`,
        [`${grade} Charging Bay %`],
      );
      const existingCount = countResult.rows[0].cnt;
      if (existingCount >= 5) continue;

      for (const item of candidates) {
        await pgPool.query(
          `INSERT INTO resources (id, school_id, type, name, class_room, total_quantity, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            item.id,
            item.schoolId,
            item.type,
            item.name,
            item.classRoom,
            item.totalQuantity,
            item.description,
          ],
        );
      }
      continue;
    }

    const existingCount = sqlite
      .prepare(
        `SELECT COUNT(*) as cnt FROM resources WHERE type = 'cabinet' AND name LIKE ?`,
      )
      .get(`${grade} Charging Bay %`).cnt;

    if (existingCount >= 5) continue;

    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO resources (id, school_id, type, name, class_room, total_quantity, description)
       VALUES (@id, @schoolId, @type, @name, @classRoom, @totalQuantity, @description)`,
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
      resourceId: "res-g7-cab-1",
      borrower: "Ms. Johnson",
      borrowerClass: "Year 7",
      quantity: 15,
      startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      status: "active",
      notes: "Year 7 Science project",
    },
    {
      resourceId: "res-g8-cab-1",
      borrower: "Mr. Smith",
      borrowerClass: "Year 8",
      quantity: 30,
      startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
      status: "active",
      notes: "Year 8 Digital Literacy exam",
    },
    {
      resourceId: "res-005",
      borrower: "Alice Chen",
      borrowerClass: "Year 9",
      quantity: 1,
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      actualReturnTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      status: "returned",
      notes: "Independent research",
    },
    {
      resourceId: "res-g9-cab-1",
      borrower: "Mrs. Williams",
      borrowerClass: "Year 9",
      quantity: 10,
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      status: "active",
      notes: "Geography mapping exercise",
    },
    {
      resourceId: "res-g8-cab-2",
      borrower: "Mr. Patel",
      borrowerClass: "Year 10",
      quantity: 20,
      startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      status: "active",
      notes: "Digital Arts portfolio work",
    },
    {
      resourceId: "res-007",
      borrower: "Sarah Kim",
      borrowerClass: "Staff",
      quantity: 1,
      startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      status: "active",
      notes: "Staff meeting notes",
    },
    {
      resourceId: "res-g7-cab-2",
      borrower: "Ms. Brown",
      borrowerClass: "Year 7",
      quantity: 10,
      startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      actualReturnTime: new Date(
        now.getTime() - 2 * 60 * 60 * 1000,
      ).toISOString(),
      status: "returned",
      notes: "Maths assessment completed",
    },
    {
      resourceId: "res-009",
      borrower: "Jake Thompson",
      borrowerClass: "Year 8",
      quantity: 1,
      startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      status: "cancelled",
      notes: "Cancelled - student absent",
    },
  ];
}

async function initPostgres() {
  const { Pool } = require("pg");

  console.log("[DB] Initializing PostgreSQL connection...");
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.PGSSLMODE === "disable"
        ? false
        : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    max: 5,
  });

  pgPool.on("error", (err) => {
    console.error("[DB] PostgreSQL pool error:", err);
  });

  await pgPool.query("SELECT 1");
  console.log("[DB] PostgreSQL connection OK.");

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
      password_hash TEXT,
      reset_token TEXT,
      reset_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS whitelist_emails (
      email TEXT PRIMARY KEY,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whitelist_removal_requests (
      email TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whitelist_removal_votes (
      email TEXT NOT NULL,
      voter_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (email, voter_email)
    );

    CREATE TABLE IF NOT EXISTS whitelist_requests (
      email TEXT PRIMARY KEY,
      requested_by TEXT,
      message TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT",
  );
  await pgPool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT",
  );
  await pgPool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ",
  );

  const schoolCount = await pgPool.query(
    "SELECT COUNT(*)::int as cnt FROM schools",
  );
  if (schoolCount.rows[0].cnt > 0) return;

  await pgPool.query(
    "INSERT INTO schools (id, name, campus) VALUES ($1, $2, $3)",
    ["school-default", "Stonepark Intermediate School", "Main Campus"],
  );

  for (const r of buildSeedResources()) {
    await pgPool.query(
      `INSERT INTO resources (id, school_id, type, name, class_room, total_quantity, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        r.id,
        "school-default",
        r.type,
        r.name,
        r.classRoom,
        r.totalQuantity,
        r.description || "",
      ],
    );
  }

  const { randomUUID } = require("node:crypto");
  for (const b of buildSeedBookings()) {
    await pgPool.query(
      `INSERT INTO bookings (id, resource_id, borrower, borrower_class, quantity,
       start_time, end_time, actual_return_time, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        b.resourceId,
        b.borrower,
        b.borrowerClass,
        b.quantity,
        b.startTime,
        b.endTime,
        b.actualReturnTime || null,
        b.status,
        b.notes || "",
      ],
    );
  }
}

function initSqlite() {
  const Database = require("better-sqlite3");

  const dbPath =
    process.env.DB_PATH ||
    path.join(__dirname, "..", "..", "data", "chromebook.db");
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

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
      password_hash TEXT,
      reset_token TEXT,
      reset_expires TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS whitelist_emails (
      email TEXT PRIMARY KEY,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS whitelist_removal_requests (
      email TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS whitelist_removal_votes (
      email TEXT NOT NULL,
      voter_email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (email, voter_email)
    );

    CREATE TABLE IF NOT EXISTS whitelist_requests (
      email TEXT PRIMARY KEY,
      requested_by TEXT,
      message TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureSqliteUserColumns();
}

function ensureSqliteUserColumns() {
  const columns = sqlite
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((c) => c.name);
  const ensureColumn = (name, type) => {
    if (columns.includes(name)) return;
    sqlite.prepare(`ALTER TABLE users ADD COLUMN ${name} ${type}`).run();
  };

  ensureColumn("password_hash", "TEXT");
  ensureColumn("reset_token", "TEXT");
  ensureColumn("reset_expires", "TEXT");
}

async function seedSqliteIfEmpty() {
  const schoolCount = sqlite
    .prepare("SELECT COUNT(*) as cnt FROM schools")
    .get().cnt;
  if (schoolCount > 0) return;

  sqlite
    .prepare(
      "INSERT INTO schools (id, name, campus) VALUES (@id, @name, @campus)",
    )
    .run({
      id: "school-default",
      name: "Stonepark Intermediate School",
      campus: "Main Campus",
    });

  const insertResource = sqlite.prepare(
    `INSERT INTO resources (id, school_id, type, name, class_room, total_quantity, description)
     VALUES (@id, @schoolId, @type, @name, @classRoom, @totalQuantity, @description)`,
  );

  for (const r of buildSeedResources()) {
    insertResource.run({
      id: r.id,
      schoolId: "school-default",
      type: r.type,
      name: r.name,
      classRoom: r.classRoom,
      totalQuantity: r.totalQuantity,
      description: r.description || "",
    });
  }

  const insertBooking = sqlite.prepare(
    `INSERT INTO bookings (id, resource_id, borrower, borrower_class, quantity,
     start_time, end_time, actual_return_time, status, notes)
     VALUES (@id, @resourceId, @borrower, @borrowerClass, @quantity,
     @startTime, @endTime, @actualReturnTime, @status, @notes)`,
  );

  const { randomUUID } = require("node:crypto");
  for (const b of buildSeedBookings()) {
    insertBooking.run({
      id: randomUUID(),
      resourceId: b.resourceId,
      borrower: b.borrower,
      borrowerClass: b.borrowerClass,
      quantity: b.quantity,
      startTime: b.startTime,
      endTime: b.endTime,
      actualReturnTime: b.actualReturnTime || null,
      status: b.status,
      notes: b.notes || "",
    });
  }
}

async function ensureInit() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (USE_POSTGRES) {
      await initPostgres();
      await removeLegacyCabinets();
      await ensureAdminUsers();
      await ensureStaffUsers();
      await ensureWhitelistSeeds();
      return;
    }

    initSqlite();
    await seedSqliteIfEmpty();
    await removeLegacyCabinets();
    await ensureAdminUsers();
    await ensureStaffUsers();
    await ensureWhitelistSeeds();
  })();

  return initPromise;
}

async function ensureAdminUsers() {
  const admins = parseAdminUsers();
  if (admins.length === 0) return;

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password, 10);
    const name = admin.email.split("@")[0];

    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO users (id, school_id, email, name, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           role = EXCLUDED.role,
           name = EXCLUDED.name,
           password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)`,
        [
          `admin-${admin.email}`,
          "school-default",
          admin.email,
          name,
          "admin",
          passwordHash,
        ],
      );
      continue;
    }

    sqlite
      .prepare(
        `INSERT INTO users (id, school_id, email, name, role, password_hash)
       VALUES (@id, @schoolId, @email, @name, @role, @passwordHash)
       ON CONFLICT(email) DO UPDATE SET
         role = excluded.role,
         name = excluded.name,
         password_hash = COALESCE(users.password_hash, excluded.password_hash)`,
      )
      .run({
        id: `admin-${admin.email}`,
        schoolId: "school-default",
        email: admin.email,
        name,
        role: "admin",
        passwordHash,
      });
  }
}

async function ensureStaffUsers() {
  const staffUsers = parseStaffUsers();
  if (staffUsers.length === 0) return;

  for (const staff of staffUsers) {
    const passwordHash = await bcrypt.hash(staff.password, 10);
    const name = staff.name || staff.email.split("@")[0];

    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO users (id, school_id, email, name, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)`,
        [
          `staff-${staff.email}`,
          "school-default",
          staff.email,
          name,
          "staff",
          passwordHash,
        ],
      );
      continue;
    }

    sqlite
      .prepare(
        `INSERT INTO users (id, school_id, email, name, role, password_hash)
       VALUES (@id, @schoolId, @email, @name, @role, @passwordHash)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         password_hash = COALESCE(users.password_hash, excluded.password_hash)`,
      )
      .run({
        id: `staff-${staff.email}`,
        schoolId: "school-default",
        email: staff.email,
        name,
        role: "staff",
        passwordHash,
      });
  }
}

async function ensureWhitelistSeeds() {
  const seedEmails = parseWhitelistSeed();
  if (seedEmails.length === 0) return;

  if (USE_POSTGRES) {
    for (const email of seedEmails) {
      await pgPool.query(
        `INSERT INTO whitelist_emails (email, created_by)
         VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [email, "seed"],
      );
    }

    const admins = parseAdminUsers().map((a) => a.email);
    for (const email of admins) {
      await pgPool.query(
        `INSERT INTO whitelist_emails (email, created_by)
         VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [email, "admin-seed"],
      );
    }
    return;
  }

  const insert = sqlite.prepare(
    `INSERT OR IGNORE INTO whitelist_emails (email, created_by)
     VALUES (@email, @createdBy)`,
  );

  for (const email of seedEmails) {
    insert.run({ email, createdBy: "seed" });
  }

  const admins = parseAdminUsers().map((a) => a.email);
  for (const email of admins) {
    insert.run({ email, createdBy: "admin-seed" });
  }
}

async function removeLegacyCabinets() {
  if (USE_POSTGRES) {
    await pgPool.query(
      "DELETE FROM bookings WHERE resource_id = ANY($1::text[])",
      [LEGACY_CABINET_IDS],
    );
    await pgPool.query(
      "DELETE FROM resources WHERE id = ANY($1::text[]) OR name = ANY($2::text[])",
      [LEGACY_CABINET_IDS, LEGACY_CABINET_NAMES],
    );
    return;
  }

  const idPlaceholders = LEGACY_CABINET_IDS.map(() => "?").join(",");
  const namePlaceholders = LEGACY_CABINET_NAMES.map(() => "?").join(",");

  sqlite
    .prepare(`DELETE FROM bookings WHERE resource_id IN (${idPlaceholders})`)
    .run(...LEGACY_CABINET_IDS);

  sqlite
    .prepare(
      `DELETE FROM resources WHERE id IN (${idPlaceholders}) OR name IN (${namePlaceholders})`,
    )
    .run(...LEGACY_CABINET_IDS, ...LEGACY_CABINET_NAMES);
}

const resourcesDB = {
  async getAll(schoolId) {
    await ensureInit();

    if (USE_POSTGRES) {
      if (schoolId) {
        const result = await pgPool.query(
          "SELECT * FROM resources WHERE school_id = $1 ORDER BY name",
          [schoolId],
        );
        return result.rows.map(rowToResource);
      }
      const result = await pgPool.query(
        "SELECT * FROM resources ORDER BY name",
      );
      return result.rows.map(rowToResource);
    }

    if (schoolId) {
      return sqlite
        .prepare("SELECT * FROM resources WHERE school_id = ? ORDER BY name")
        .all(schoolId)
        .map(rowToResource);
    }
    return sqlite
      .prepare("SELECT * FROM resources ORDER BY name")
      .all()
      .map(rowToResource);
  },

  async getById(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM resources WHERE id = $1",
        [id],
      );
      return result.rows[0] ? rowToResource(result.rows[0]) : null;
    }

    const row = sqlite.prepare("SELECT * FROM resources WHERE id = ?").get(id);
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
          resource.schoolId || "school-default",
          resource.type,
          resource.name,
          resource.classRoom,
          resource.totalQuantity,
          resource.description || "",
        ],
      );
      return this.getById(resource.id);
    }

    sqlite
      .prepare(
        `INSERT INTO resources (id, school_id, type, name, class_room, total_quantity, description)
       VALUES (@id, @schoolId, @type, @name, @classRoom, @totalQuantity, @description)`,
      )
      .run({
        id: resource.id,
        schoolId: resource.schoolId || "school-default",
        type: resource.type,
        name: resource.name,
        classRoom: resource.classRoom,
        totalQuantity: resource.totalQuantity,
        description: resource.description || "",
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
        [
          updated.name,
          updated.classRoom,
          updated.totalQuantity,
          updated.description,
          id,
        ],
      );
      return this.getById(id);
    }

    sqlite
      .prepare(
        `UPDATE resources SET name = @name, class_room = @classRoom,
       total_quantity = @totalQuantity, description = @description WHERE id = @id`,
      )
      .run({
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
      await pgPool.query("DELETE FROM resources WHERE id = $1", [id]);
      return;
    }

    sqlite.prepare("DELETE FROM resources WHERE id = ?").run(id);
  },

  async hasActiveBookings(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT COUNT(*)::int as cnt FROM bookings WHERE resource_id = $1 AND status = 'active'",
        [id],
      );
      return result.rows[0].cnt > 0;
    }

    const row = sqlite
      .prepare(
        "SELECT COUNT(*) as cnt FROM bookings WHERE resource_id = ? AND status = 'active'",
      )
      .get(id);
    return row.cnt > 0;
  },
};

const bookingsDB = {
  async getAll({ resourceId, status, search, schoolId } = {}) {
    await ensureInit();

    if (USE_POSTGRES) {
      let query = "SELECT b.* FROM bookings b";
      const params = [];
      const conditions = [];

      if (schoolId) {
        query += " JOIN resources r ON b.resource_id = r.id";
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
        conditions.push(
          `(LOWER(b.borrower) LIKE ${a} OR LOWER(b.borrower_class) LIKE ${b})`,
        );
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }
      query += " ORDER BY b.start_time DESC";

      const result = await pgPool.query(query, params);
      return result.rows.map(rowToBooking);
    }

    let query = "SELECT b.* FROM bookings b";
    const params = [];
    const conditions = [];

    if (schoolId) {
      query += " JOIN resources r ON b.resource_id = r.id";
      conditions.push("r.school_id = ?");
      params.push(schoolId);
    }
    if (resourceId) {
      conditions.push("b.resource_id = ?");
      params.push(resourceId);
    }
    if (status) {
      conditions.push("b.status = ?");
      params.push(status);
    }
    if (search) {
      conditions.push(
        "(LOWER(b.borrower) LIKE ? OR LOWER(b.borrower_class) LIKE ?)",
      );
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY b.start_time DESC";

    return sqlite
      .prepare(query)
      .all(...params)
      .map(rowToBooking);
  },

  async getById(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM bookings WHERE id = $1",
        [id],
      );
      return result.rows[0] ? rowToBooking(result.rows[0]) : null;
    }

    const row = sqlite.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
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
          booking.notes || "",
        ],
      );
      return this.getById(booking.id);
    }

    sqlite
      .prepare(
        `INSERT INTO bookings (id, resource_id, borrower, borrower_class, quantity,
       start_time, end_time, actual_return_time, status, notes)
       VALUES (@id, @resourceId, @borrower, @borrowerClass, @quantity,
       @startTime, @endTime, @actualReturnTime, @status, @notes)`,
      )
      .run({
        id: booking.id,
        resourceId: booking.resourceId,
        borrower: booking.borrower,
        borrowerClass: booking.borrowerClass,
        quantity: booking.quantity,
        startTime: booking.startTime,
        endTime: booking.endTime,
        actualReturnTime: booking.actualReturnTime || null,
        status: booking.status,
        notes: booking.notes || "",
      });
    return this.getById(booking.id);
  },

  async update(id, fields) {
    const booking = await this.getById(id);
    if (!booking) return null;

    const updated = { ...booking, ...fields };

    if (USE_POSTGRES) {
      await pgPool.query(
        `UPDATE bookings SET status = $1, actual_return_time = $2, notes = $3 WHERE id = $4`,
        [
          updated.status,
          updated.actualReturnTime || null,
          updated.notes || "",
          id,
        ],
      );
      return this.getById(id);
    }

    sqlite
      .prepare(
        `UPDATE bookings SET status = @status, actual_return_time = @actualReturnTime, notes = @notes WHERE id = @id`,
      )
      .run({
        id,
        status: updated.status,
        actualReturnTime: updated.actualReturnTime || null,
        notes: updated.notes || "",
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
      query += " AND id != ?";
      params.push(excludeId);
    }
    return sqlite
      .prepare(query)
      .all(...params)
      .map(rowToBooking);
  },
};

const usersDB = {
  async getByEmail(email) {
    await ensureInit();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM users WHERE LOWER(email) = $1",
        [email.toLowerCase()],
      );
      return result.rows[0] || null;
    }
    return (
      sqlite
        .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
        .get(email.toLowerCase()) || null
    );
  },

  async setRole(email, role) {
    await ensureInit();
    const normalized = (email || "").toLowerCase();
    if (!normalized) return null;
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "UPDATE users SET role = $1 WHERE LOWER(email) = $2 RETURNING *",
        [role, normalized],
      );
      return result.rows[0] || null;
    }
    sqlite
      .prepare("UPDATE users SET role = ? WHERE LOWER(email) = ?")
      .run(role, normalized);
    return this.getByEmail(normalized);
  },

  async verifyPassword(email, password) {
    const user = await this.getByEmail(email);
    if (!user || !user.password_hash) return null;
    const ok = await bcrypt.compare(password, user.password_hash);
    return ok ? user : null;
  },

  async setResetToken(email, token, expiresAt) {
    await ensureInit();
    if (USE_POSTGRES) {
      await pgPool.query(
        "UPDATE users SET reset_token = $1, reset_expires = $2 WHERE LOWER(email) = $3",
        [token, expiresAt, email.toLowerCase()],
      );
      return;
    }
    sqlite
      .prepare(
        "UPDATE users SET reset_token = ?, reset_expires = ? WHERE LOWER(email) = ?",
      )
      .run(token, expiresAt, email.toLowerCase());
  },

  async resetPassword(token, newPasswordHash) {
    await ensureInit();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        `UPDATE users
         SET password_hash = $1, reset_token = NULL, reset_expires = NULL
         WHERE reset_token = $2 AND reset_expires > NOW()
         RETURNING *`,
        [newPasswordHash, token],
      );
      return result.rows[0] || null;
    }

    const now = new Date().toISOString();
    const user = sqlite
      .prepare(
        "SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?",
      )
      .get(token, now);
    if (!user) return null;
    sqlite
      .prepare(
        "UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
      )
      .run(newPasswordHash, user.id);
    return user;
  },

  async createUser({
    email,
    name,
    role,
    passwordHash,
    schoolId = "school-default",
  }) {
    await ensureInit();
    const { randomUUID } = require("node:crypto");
    const id = randomUUID();

    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO users (id, school_id, email, name, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, schoolId, email.toLowerCase(), name, role, passwordHash],
      );
      return this.getByEmail(email);
    }

    sqlite
      .prepare(
        `INSERT INTO users (id, school_id, email, name, role, password_hash)
       VALUES (@id, @schoolId, @email, @name, @role, @passwordHash)`,
      )
      .run({
        id,
        schoolId,
        email: email.toLowerCase(),
        name,
        role,
        passwordHash,
      });
    return this.getByEmail(email);
  },

  async upsertGoogleUser({
    email,
    name,
    googleId,
    role,
    schoolId = "school-default",
  }) {
    await ensureInit();
    const normalized = (email || "").toLowerCase();
    if (!normalized || !googleId) return null;
    const displayName = name || normalized.split("@")[0];
    const id = `google-${googleId}`;

    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO users (id, school_id, email, name, role, google_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           google_id = EXCLUDED.google_id,
           role = CASE
             WHEN users.role = 'admin' THEN users.role
             ELSE EXCLUDED.role
           END`,
        [id, schoolId, normalized, displayName, role, googleId],
      );
      return this.getByEmail(normalized);
    }

    sqlite
      .prepare(
        `INSERT INTO users (id, school_id, email, name, role, google_id)
       VALUES (@id, @schoolId, @email, @name, @role, @googleId)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         google_id = excluded.google_id,
         role = CASE
           WHEN users.role = 'admin' THEN users.role
           ELSE excluded.role
         END`,
      )
      .run({
        id,
        schoolId,
        email: normalized,
        name: displayName,
        role,
        googleId,
      });
    return this.getByEmail(normalized);
  },

  async getAll() {
    await ensureInit();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT id, school_id, email, name, role FROM users ORDER BY role, email",
      );
      return result.rows;
    }
    return (
      sqlite
        .prepare(
          "SELECT id, school_id, email, name, role FROM users ORDER BY role, email",
        )
        .all() || []
    );
  },

  async deleteUser(email) {
    await ensureInit();
    const normalized = (email || "").toLowerCase();
    if (!normalized) return;
    if (USE_POSTGRES) {
      await pgPool.query("DELETE FROM users WHERE LOWER(email) = $1", [
        normalized,
      ]);
      return;
    }
    sqlite.prepare("DELETE FROM users WHERE LOWER(email) = ?").run(normalized);
  },

  async adminSetPassword(email, passwordHash) {
    await ensureInit();
    const normalized = (email || "").toLowerCase();
    if (!normalized) return null;
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2 RETURNING *",
        [passwordHash, normalized],
      );
      return result.rows[0] || null;
    }
    sqlite
      .prepare("UPDATE users SET password_hash = ? WHERE LOWER(email) = ?")
      .run(passwordHash, normalized);
    return this.getByEmail(normalized);
  },

  async getAdmins() {
    await ensureInit();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM users WHERE role = 'admin' ORDER BY email",
      );
      return result.rows;
    }
    return sqlite
      .prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY email")
      .all();
  },
};

const whitelistDB = {
  async getAll() {
    await ensureInit();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM whitelist_emails ORDER BY email",
      );
      return result.rows;
    }
    return sqlite
      .prepare("SELECT * FROM whitelist_emails ORDER BY email")
      .all();
  },

  async isWhitelisted(email) {
    if (!email) return false;
    await ensureInit();
    const normalized = email.toLowerCase();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT email FROM whitelist_emails WHERE email = $1",
        [normalized],
      );
      return !!result.rows[0];
    }
    const row = sqlite
      .prepare("SELECT email FROM whitelist_emails WHERE email = ?")
      .get(normalized);
    return !!row;
  },

  async add(email, createdBy = "admin") {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return null;

    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO whitelist_emails (email, created_by)
         VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [normalized, createdBy],
      );
      const result = await pgPool.query(
        "SELECT * FROM whitelist_emails WHERE email = $1",
        [normalized],
      );
      return result.rows[0] || null;
    }

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO whitelist_emails (email, created_by)
       VALUES (?, ?)`,
      )
      .run(normalized, createdBy);
    return (
      sqlite
        .prepare("SELECT * FROM whitelist_emails WHERE email = ?")
        .get(normalized) || null
    );
  },

  async remove(email) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return false;

    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "DELETE FROM whitelist_emails WHERE email = $1",
        [normalized],
      );
      return result.rowCount > 0;
    }

    const info = sqlite
      .prepare("DELETE FROM whitelist_emails WHERE email = ?")
      .run(normalized);
    return info.changes > 0;
  },
};

const whitelistRemovalDB = {
  async getAll() {
    await ensureInit();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM whitelist_removal_requests ORDER BY created_at DESC",
      );
      return result.rows;
    }
    return sqlite
      .prepare(
        "SELECT * FROM whitelist_removal_requests ORDER BY created_at DESC",
      )
      .all();
  },

  async getByEmail(email) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return null;
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM whitelist_removal_requests WHERE email = $1",
        [normalized],
      );
      return result.rows[0] || null;
    }
    return (
      sqlite
        .prepare("SELECT * FROM whitelist_removal_requests WHERE email = ?")
        .get(normalized) || null
    );
  },

  async createRequest(email, createdBy) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return null;
    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO whitelist_removal_requests (email, created_by)
         VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [normalized, createdBy],
      );
      const result = await pgPool.query(
        "SELECT * FROM whitelist_removal_requests WHERE email = $1",
        [normalized],
      );
      return result.rows[0] || null;
    }
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO whitelist_removal_requests (email, created_by)
       VALUES (?, ?)`,
      )
      .run(normalized, createdBy);
    return (
      sqlite
        .prepare("SELECT * FROM whitelist_removal_requests WHERE email = ?")
        .get(normalized) || null
    );
  },

  async addVote(email, voterEmail) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    const voter = (voterEmail || "").trim().toLowerCase();
    if (!normalized || !voter) return false;
    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO whitelist_removal_votes (email, voter_email)
         VALUES ($1, $2)
         ON CONFLICT (email, voter_email) DO NOTHING`,
        [normalized, voter],
      );
      return true;
    }
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO whitelist_removal_votes (email, voter_email)
       VALUES (?, ?)`,
      )
      .run(normalized, voter);
    return true;
  },

  async countVotes(email) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return 0;
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT COUNT(*)::int as cnt FROM whitelist_removal_votes WHERE email = $1",
        [normalized],
      );
      return result.rows[0]?.cnt || 0;
    }
    const row = sqlite
      .prepare(
        "SELECT COUNT(*) as cnt FROM whitelist_removal_votes WHERE email = ?",
      )
      .get(normalized);
    return row?.cnt || 0;
  },

  async hasVoted(email, voterEmail) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    const voter = (voterEmail || "").trim().toLowerCase();
    if (!normalized || !voter) return false;
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT email FROM whitelist_removal_votes WHERE email = $1 AND voter_email = $2",
        [normalized, voter],
      );
      return !!result.rows[0];
    }
    const row = sqlite
      .prepare(
        "SELECT email FROM whitelist_removal_votes WHERE email = ? AND voter_email = ?",
      )
      .get(normalized, voter);
    return !!row;
  },

  async clearRequest(email) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return;
    if (USE_POSTGRES) {
      await pgPool.query(
        "DELETE FROM whitelist_removal_votes WHERE email = $1",
        [normalized],
      );
      await pgPool.query(
        "DELETE FROM whitelist_removal_requests WHERE email = $1",
        [normalized],
      );
      return;
    }
    sqlite
      .prepare("DELETE FROM whitelist_removal_votes WHERE email = ?")
      .run(normalized);
    sqlite
      .prepare("DELETE FROM whitelist_removal_requests WHERE email = ?")
      .run(normalized);
  },
};

const whitelistRequestsDB = {
  async getAll() {
    await ensureInit();
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM whitelist_requests ORDER BY created_at DESC",
      );
      return result.rows;
    }
    return sqlite
      .prepare("SELECT * FROM whitelist_requests ORDER BY created_at DESC")
      .all();
  },

  async getByEmail(email) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return null;
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "SELECT * FROM whitelist_requests WHERE email = $1",
        [normalized],
      );
      return result.rows[0] || null;
    }
    return (
      sqlite
        .prepare("SELECT * FROM whitelist_requests WHERE email = ?")
        .get(normalized) || null
    );
  },

  async createRequest(email, requestedBy = null, message = "") {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return null;
    if (USE_POSTGRES) {
      await pgPool.query(
        `INSERT INTO whitelist_requests (email, requested_by, message)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [normalized, requestedBy || null, message || ""],
      );
      const result = await pgPool.query(
        "SELECT * FROM whitelist_requests WHERE email = $1",
        [normalized],
      );
      return result.rows[0] || null;
    }

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO whitelist_requests (email, requested_by, message)
       VALUES (?, ?, ?)`,
      )
      .run(normalized, requestedBy || null, message || "");
    return (
      sqlite
        .prepare("SELECT * FROM whitelist_requests WHERE email = ?")
        .get(normalized) || null
    );
  },

  async removeRequest(email) {
    await ensureInit();
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return false;
    if (USE_POSTGRES) {
      const result = await pgPool.query(
        "DELETE FROM whitelist_requests WHERE email = $1",
        [normalized],
      );
      return result.rowCount > 0;
    }
    const info = sqlite
      .prepare("DELETE FROM whitelist_requests WHERE email = ?")
      .run(normalized);
    return info.changes > 0;
  },
};

const schoolsDB = {
  async getAll() {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query("SELECT * FROM schools ORDER BY name");
      return result.rows;
    }

    return sqlite.prepare("SELECT * FROM schools ORDER BY name").all();
  },

  async getById(id) {
    await ensureInit();

    if (USE_POSTGRES) {
      const result = await pgPool.query("SELECT * FROM schools WHERE id = $1", [
        id,
      ]);
      return result.rows[0] || null;
    }

    return sqlite.prepare("SELECT * FROM schools WHERE id = ?").get(id) || null;
  },

  async create(school) {
    await ensureInit();

    if (USE_POSTGRES) {
      await pgPool.query(
        "INSERT INTO schools (id, name, campus) VALUES ($1, $2, $3)",
        [school.id, school.name, school.campus],
      );
      return this.getById(school.id);
    }

    sqlite
      .prepare(
        "INSERT INTO schools (id, name, campus) VALUES (@id, @name, @campus)",
      )
      .run(school);
    return this.getById(school.id);
  },
};

ensureInit()
  .then(() => ensureMinimumGradeChargingBays())
  .catch((err) => {
    console.error("[DB] Initialization or backfill failed:", err);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  });

module.exports = {
  resourcesDB,
  bookingsDB,
  usersDB,
  whitelistDB,
  whitelistRemovalDB,
  whitelistRequestsDB,
  schoolsDB,
  ready: ensureInit,
};

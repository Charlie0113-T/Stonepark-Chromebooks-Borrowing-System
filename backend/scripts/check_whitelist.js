const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'chromebook.db');
try {
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare('SELECT email, created_by, created_at FROM whitelist_emails ORDER BY created_at DESC LIMIT 200').all();
  console.log(JSON.stringify(rows, null, 2));
  db.close();
} catch (err) {
  console.error('ERROR', err && (err.message || err));
  process.exit(2);
}

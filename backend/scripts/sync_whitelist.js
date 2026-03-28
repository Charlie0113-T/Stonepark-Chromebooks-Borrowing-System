#!/usr/bin/env node
const path = require('path');
const Database = require('better-sqlite3');

const remoteUrl = process.env.DATABASE_URL || process.env.REMOTE_DATABASE_URL || '';
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'chromebook.db');

function normalize(email) {
  return (email || '').trim().toLowerCase();
}

async function run() {
  console.log('[sync] Local DB:', dbPath);

  // Load local sqlite emails
  const sqlite = new Database(dbPath);
  const localRows = sqlite.prepare('SELECT email, created_by, created_at FROM whitelist_emails').all();
  const localSet = new Set(localRows.map((r) => normalize(r.email)));

  console.log(`[sync] Local whitelist count: ${localSet.size}`);

  let remoteSet = new Set();
  let pgClient = null;

  if (remoteUrl) {
    // Lazy require so script still works without pg installed in some envs
    const { Client } = require('pg');
    pgClient = new Client({ connectionString: remoteUrl, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } });
    await pgClient.connect();
    const res = await pgClient.query('SELECT email FROM whitelist_emails');
    for (const row of res.rows) {
      remoteSet.add(normalize(row.email));
    }
    console.log(`[sync] Remote whitelist count: ${remoteSet.size}`);
  } else {
    console.log('[sync] No remote DATABASE_URL configured; remote sync will be skipped.');
  }

  // Compare
  const toAddToLocal = [];
  const toAddToRemote = [];

  if (remoteUrl) {
    for (const e of remoteSet) if (!localSet.has(e)) toAddToLocal.push(e);
    for (const e of localSet) if (!remoteSet.has(e)) toAddToRemote.push(e);
  }

  // If no remote configured, nothing to sync except show local list
  if (!remoteUrl) {
    console.log('[sync] Local emails:');
    for (const e of Array.from(localSet).sort()) console.log('  -', e);
    sqlite.close();
    return;
  }

  if (toAddToLocal.length === 0 && toAddToRemote.length === 0) {
    console.log('[sync] Already in sync. No changes required.');
  } else {
    console.log(`[sync] Will add ${toAddToLocal.length} email(s) to local and ${toAddToRemote.length} email(s) to remote.`);

    // Add missing remote -> local
    if (toAddToLocal.length > 0) {
      const insert = sqlite.prepare('INSERT OR IGNORE INTO whitelist_emails (email, created_by) VALUES (?, ?)');
      const insTxn = sqlite.transaction((items) => {
        for (const e of items) insert.run(e, 'sync-remote');
      });
      insTxn(toAddToLocal);
      console.log(`[sync] Inserted ${toAddToLocal.length} into local sqlite`);
    }

    // Add missing local -> remote
    if (toAddToRemote.length > 0) {
      const insertRemoteText = `INSERT INTO whitelist_emails (email, created_by) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`;
      for (const e of toAddToRemote) {
        await pgClient.query(insertRemoteText, [e, 'sync-local']);
      }
      console.log(`[sync] Inserted ${toAddToRemote.length} into remote Postgres`);
    }
  }

  if (pgClient) await pgClient.end();
  sqlite.close();
  console.log('[sync] Done.');
}

run().catch((err) => {
  console.error('[sync] ERROR:', err && (err.message || err));
  process.exit(2);
});

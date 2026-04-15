/**
 * One-shot operational data reset (Option A).
 * Keeps: superadmin user, Cars24 company, audit_checks (291), migrations.
 * Deletes: all sites, crawl jobs, audit results, error logs, stale OAuth tokens.
 * Deletes: admin@c24.com (migration artifact with known default password).
 *
 * Run once: node backend/db/reset.js
 */
import db from './sqlite.js';

const reset = db.transaction(() => {
  db.prepare('DELETE FROM audit_results').run();
  db.prepare('DELETE FROM crawl_jobs').run();
  db.prepare('DELETE FROM sites').run();
  db.prepare('DELETE FROM error_log').run();
  db.prepare('DELETE FROM ad_oauth_state').run();
  db.prepare('DELETE FROM audit_log').run();
  db.prepare("DELETE FROM users WHERE email != 'aakash.srivastava@cars24.com'").run();
});

reset();

// Verify
const checks = [
  { table: 'audit_results', expected: 0 },
  { table: 'crawl_jobs',    expected: 0 },
  { table: 'sites',         expected: 0 },
  { table: 'users',         expected: 1 },
  { table: 'audit_checks',  expected: 291 },
];

let allOk = true;
for (const { table, expected } of checks) {
  const { cnt } = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get();
  const ok = cnt === expected;
  console.log(`${ok ? '✓' : '✗'} ${table}: ${cnt} rows (expected ${expected})`);
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error('\nReset incomplete — check above failures.');
  process.exit(1);
}

console.log('\nReset complete. Platform is clean.');
db.close();

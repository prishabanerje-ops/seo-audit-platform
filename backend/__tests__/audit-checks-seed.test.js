// backend/__tests__/audit-checks-seed.test.js
/**
 * Audit checks seed v2 tests.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { AUDIT_CHECKS, seedAuditChecks } from '../db/seed/audit-checks.js';

const VALID_FEASIBILITY = ['automated','gsc','ga4','psi','crux','kw_upload','bl_upload','ai','manual'];
const VALID_SEVERITY    = ['critical','warning','info'];

let db;

beforeAll(() => {
  db = new BetterSqlite3(':memory:');
  // Schema matches what seedAuditChecks actually inserts:
  // INSERT OR IGNORE INTO audit_checks (check_id, name, section, severity_default, feasibility)
  // Idempotency is enforced via UNIQUE on check_id (not check_number).
  // check_number and category are nullable because seedAuditChecks does not insert them.
  db.prepare(`
    CREATE TABLE audit_checks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      check_number     INTEGER,
      name             TEXT NOT NULL,
      category         TEXT,
      section          TEXT,
      check_id         TEXT UNIQUE,
      severity_default TEXT DEFAULT 'warning',
      feasibility      TEXT,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  seedAuditChecks(db);
});

describe('AUDIT_CHECKS array', () => {
  it('exports at least 300 checks', () => {
    expect(AUDIT_CHECKS.length).toBeGreaterThanOrEqual(300);
  });

  it('has no duplicate check_ids', () => {
    const ids = AUDIT_CHECKS.map(c => c.check_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every check has check_id, name, section, severity, feasibility', () => {
    for (const c of AUDIT_CHECKS) {
      expect(c.check_id,    `check_id missing on: ${c.name}`).toBeTruthy();
      expect(c.name,        `name missing on: ${c.check_id}`).toBeTruthy();
      expect(c.section,     `section missing on: ${c.check_id}`).toBeTruthy();
      expect(c.severity,    `severity missing on: ${c.check_id}`).toBeTruthy();
      expect(c.feasibility, `feasibility missing on: ${c.check_id}`).toBeTruthy();
    }
  });

  it('every severity is critical, warning, or info', () => {
    const invalid = AUDIT_CHECKS.filter(c => !VALID_SEVERITY.includes(c.severity));
    expect(invalid.map(c => c.check_id)).toHaveLength(0);
  });

  it('every feasibility is a known tier', () => {
    const invalid = AUDIT_CHECKS.filter(c => !VALID_FEASIBILITY.includes(c.feasibility));
    expect(invalid.map(c => c.check_id)).toHaveLength(0);
  });

  it('has at least 200 automated checks', () => {
    expect(AUDIT_CHECKS.filter(c => c.feasibility === 'automated').length).toBeGreaterThanOrEqual(200);
  });

  it('has at least 40 manual checks', () => {
    expect(AUDIT_CHECKS.filter(c => c.feasibility === 'manual').length).toBeGreaterThanOrEqual(40);
  });
});

describe('seedAuditChecks', () => {
  it('inserts all checks into the DB', () => {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM audit_checks').get();
    expect(n).toBe(AUDIT_CHECKS.length);
  });

  it('is idempotent — INSERT OR IGNORE prevents duplicates', () => {
    seedAuditChecks(db); // run a second time
    const { n } = db.prepare('SELECT COUNT(*) as n FROM audit_checks').get();
    expect(n).toBe(AUDIT_CHECKS.length);
  });

  it('all rows in DB have non-null check_id', () => {
    const nullRows = db.prepare('SELECT check_id FROM audit_checks WHERE check_id IS NULL').all();
    expect(nullRows).toHaveLength(0);
  });
});

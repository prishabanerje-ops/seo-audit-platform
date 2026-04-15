/**
 * Audit checks seed tests.
 * Verifies the seed produces exactly 291 rows with correct schema.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { AUDIT_CHECKS, seedAuditChecks } from '../db/seed/audit-checks.js';

let db;

beforeAll(() => {
  db = new BetterSqlite3(':memory:');
  db.prepare(`
    CREATE TABLE audit_checks (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      check_number      INTEGER NOT NULL UNIQUE,
      name              TEXT NOT NULL,
      category          TEXT NOT NULL,
      subsection        TEXT,
      description       TEXT,
      implementation_rule TEXT,
      logic_summary     TEXT,
      seo_impact        TEXT,
      tool_source       TEXT    DEFAULT 'screaming-frog',
      severity_default  TEXT    DEFAULT 'warning',
      is_automated      INTEGER DEFAULT 1,
      automation_type   TEXT    DEFAULT 'automated',
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  seedAuditChecks(db);
});

describe('AUDIT_CHECKS array', () => {
  it('exports exactly 291 checks', () => {
    expect(AUDIT_CHECKS).toHaveLength(291);
  });

  it('has no duplicate check_numbers', () => {
    const nums = AUDIT_CHECKS.map(c => c.check_number);
    expect(new Set(nums).size).toBe(291);
  });

  it('has no duplicate names', () => {
    const names = AUDIT_CHECKS.map(c => c.name);
    expect(new Set(names).size).toBe(291);
  });

  it('every check has required fields', () => {
    for (const c of AUDIT_CHECKS) {
      expect(c.check_number,     `check_number missing on: ${c.name}`).toBeTruthy();
      expect(c.name,             `name missing on check ${c.check_number}`).toBeTruthy();
      expect(c.category,         `category missing on: ${c.name}`).toBeTruthy();
      expect(c.subsection,       `subsection missing on: ${c.name}`).toBeTruthy();
      expect(c.severity_default, `severity_default missing on: ${c.name}`).toBeTruthy();
      expect(c.automation_type,  `automation_type missing on: ${c.name}`).toBeTruthy();
    }
  });

  it('every severity_default is one of: critical, warning, info', () => {
    const valid = new Set(['critical', 'warning', 'info']);
    for (const c of AUDIT_CHECKS) {
      expect(valid.has(c.severity_default), `invalid severity "${c.severity_default}" on: ${c.name}`).toBe(true);
    }
  });

  it('every automation_type is one of: automated, manual, hybrid', () => {
    const valid = new Set(['automated', 'manual', 'hybrid']);
    for (const c of AUDIT_CHECKS) {
      expect(valid.has(c.automation_type), `invalid automation_type "${c.automation_type}" on: ${c.name}`).toBe(true);
    }
  });

  it('covers all 19 expected categories', () => {
    const expected = [
      'Response Codes', 'Canonical', 'Robots / Indexability', 'Sitemap',
      'URL Structure', 'Title Tags', 'Meta Description', 'Headings',
      'Internal Linking', 'Images', 'Schema / Structured Data', 'Content',
      'Speed & Performance', 'Mobile SEO', 'JavaScript Rendering',
      'International SEO', 'Rankings & Traffic Drops',
      'Monitoring & Operations', 'LLM / AI Crawlers',
    ];
    const actual = new Set(AUDIT_CHECKS.map(c => c.category));
    for (const cat of expected) {
      expect(actual.has(cat), `missing category: ${cat}`).toBe(true);
    }
    expect(actual.size).toBe(19);
  });
});

describe('seedAuditChecks()', () => {
  it('inserts exactly 291 rows into the DB', () => {
    const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
    expect(cnt).toBe(291);
  });

  it('stores subsection on every row', () => {
    const { cnt } = db.prepare(
      "SELECT COUNT(*) AS cnt FROM audit_checks WHERE subsection IS NULL OR subsection = ''"
    ).get();
    expect(cnt).toBe(0);
  });

  it('stores automation_type on every row', () => {
    const { cnt } = db.prepare(
      "SELECT COUNT(*) AS cnt FROM audit_checks WHERE automation_type IS NULL OR automation_type = ''"
    ).get();
    expect(cnt).toBe(0);
  });

  it('is idempotent — calling again returns 0 new inserts', () => {
    const second = seedAuditChecks(db);
    expect(second).toBe(0);
    const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
    expect(cnt).toBe(291);
  });
});

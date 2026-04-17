import { describe, it, expect } from 'vitest';
import db from '../db/sqlite.js';

describe('Migration 016 — sheets_spreadsheet_id', () => {
  it('sites table has sheets_spreadsheet_id column', () => {
    const cols = db.pragma('table_info(sites)').map(c => c.name);
    expect(cols).toContain('sheets_spreadsheet_id');
  });
});

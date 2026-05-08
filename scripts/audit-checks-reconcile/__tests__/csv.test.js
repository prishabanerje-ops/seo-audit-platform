import { describe, it, expect } from 'vitest';
import { parseCsv, writeCsv } from '../src/csv.js';

describe('parseCsv', () => {
  it('parses header + rows into objects keyed by header', async () => {
    const text = 'a,b,c\n1,2,3\n4,5,6\n';
    const rows = await parseCsv(text);
    expect(rows).toEqual([{ a: '1', b: '2', c: '3' }, { a: '4', b: '5', c: '6' }]);
  });

  it('handles quoted commas inside fields', async () => {
    const text = 'name,note\n"Foo, Bar","baz, qux"\n';
    const rows = await parseCsv(text);
    expect(rows).toEqual([{ name: 'Foo, Bar', note: 'baz, qux' }]);
  });
});

describe('writeCsv', () => {
  it('writes header + rows preserving column order from `columns`', async () => {
    const text = await writeCsv(
      [{ a: '1', b: '2' }, { a: '3', b: '4' }],
      ['a', 'b'],
    );
    expect(text).toBe('a,b\n1,2\n3,4\n');
  });
});

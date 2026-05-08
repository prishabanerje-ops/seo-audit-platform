import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export async function parseCsv(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_quotes: true,
    relax_column_count: true,
  });
}

export async function writeCsv(rows, columns) {
  return stringify(rows, { header: true, columns });
}

#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './csv.js';
import { runGapmap } from './gapmap.js';
import { writeExtendedCanonicalCsv } from './output/canonical-csv.js';
import { buildGapmapSummary } from './output/summary-md.js';
import { buildSignalIndexMarkdown } from './output/signal-index-md.js';
import { buildBulkDecisions, parseBulkDecisions } from './output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from './output/individual-md.js';
import { buildDryrunTable } from './output/dryrun-md.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = join(PROJECT_ROOT, 'docs', 'audit-checks');
const CANONICAL_CSV = join(OUT_DIR, 'canonical-checks-v1.csv');

async function ensureOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function dryrun() {
  await ensureOutDir();
  const { rows, signals } = await runGapmap({ limit: 25 });
  await writeFile(join(OUT_DIR, 'gapmap-dryrun-25rows.md'), buildDryrunTable(rows));
  await writeFile(join(OUT_DIR, 'gapmap-signal-index.md'), buildSignalIndexMarkdown(signals));
  console.log('Dry-run table written to docs/audit-checks/gapmap-dryrun-25rows.md');
  console.log('Signal index written to docs/audit-checks/gapmap-signal-index.md');
}

async function fullpass() {
  await ensureOutDir();
  const { rows, signals } = await runGapmap();

  // Merge in-scope classified rows back into the full canonical CSV
  const allText = await readFile(CANONICAL_CSV, 'utf8');
  const allRows = await parseCsv(allText);
  const byId = new Map(rows.map(r => [r.check_id, r]));
  const merged = allRows.map(r => {
    const upd = byId.get(r.check_id);
    return upd ? { ...r, impl_status: upd.impl_status, impl_location: upd.impl_location, impl_evidence: upd.impl_evidence, gap_notes: upd.gap_notes } : r;
  });

  await writeFile(join(OUT_DIR, 'canonical-checks-v1.draft.csv'), await writeExtendedCanonicalCsv(merged));
  await writeFile(join(OUT_DIR, 'gapmap-run-summary.md'), buildGapmapSummary(rows, { label: 'G3 full pass' }));
  await writeFile(join(OUT_DIR, 'gapmap-bulk-decisions.md'), buildBulkDecisions(rows));
  await writeFile(join(OUT_DIR, 'gapmap-signal-index.md'), buildSignalIndexMarkdown(signals));
  console.log('Full-pass artifacts written to docs/audit-checks/.');
  console.log('NEXT: edit gapmap-bulk-decisions.md (fill `Decision:` lines), then run `applybulk`.');
}

async function applybulk() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const bulkPath = join(OUT_DIR, 'gapmap-bulk-decisions.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const bulkText = await readFile(bulkPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const bulkAnswers = parseBulkDecisions(bulkText);

  for (const ans of bulkAnswers) {
    if (ans.decision === '___' || !ans.decision) continue;
    for (const row of draftRows) {
      if (row.impl_status !== 'flag') continue;
      const reason = (row.gap_notes || '').split(':')[0].trim() || 'G-FLAG';
      if (reason !== ans.reason || row.category !== ans.category) continue;
      if (ans.decision === 'accept-implemented') { row.impl_status = 'implemented'; row.gap_notes = `bulk-implemented (${ans.reason})`; }
      else if (ans.decision === 'accept-partial') { row.impl_status = 'partial'; row.gap_notes = `bulk-partial (${ans.reason})`; }
      else if (ans.decision === 'accept-missing') { row.impl_status = 'missing'; row.gap_notes = `bulk-missing (${ans.reason})`; }
      // flag-individually keeps impl_status=flag for individual review
    }
  }

  await writeFile(draftCsvPath, await writeExtendedCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'gapmap-individual.md'), buildIndividualFlags(draftRows));
  console.log('Bulk decisions applied. Individual-flag file written.');
  console.log('NEXT: edit gapmap-individual.md (fill `Your call:` lines), then run `finalize`.');
}

async function finalize() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const individualPath = join(OUT_DIR, 'gapmap-individual.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const individualText = await readFile(individualPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const indivAnswers = parseIndividualFlags(individualText);

  for (const ans of indivAnswers) {
    if (!ans.check_id || !ans.decision || ans.decision === '___') continue;
    const row = draftRows.find(r => r.check_id === ans.check_id);
    if (!row) continue;
    if (ans.decision.startsWith('comment:')) {
      row.gap_notes = (row.gap_notes ? row.gap_notes + '; ' : '') + ans.decision;
      // leave impl_status at its prior value (don't auto-change on comment)
    } else if (['implemented', 'partial', 'missing', 'n-a'].includes(ans.decision)) {
      row.impl_status = ans.decision;
      row.gap_notes = `individual triage (${ans.decision})`;
    }
  }

  // Promote draft to final canonical CSV
  await writeFile(CANONICAL_CSV, await writeExtendedCanonicalCsv(draftRows));
  // Generate final summary (only the in-scope rows for the summary stats)
  const inScopeRows = draftRows.filter(r => r.impl_status && r.impl_status !== '');
  await writeFile(join(OUT_DIR, 'gapmap-summary.md'), buildGapmapSummary(inScopeRows, { label: 'G7 finalized' }));
  console.log('Finalized canonical CSV + gapmap-summary.md written.');
  console.log('NEXT: review, then `git rm` drafts and commit per plan Task 22.');
}

const cmd = process.argv[2];
const handlers = { dryrun, fullpass, applybulk, finalize };
if (!handlers[cmd]) {
  console.error(`Usage: node src/cli.js <dryrun|fullpass|applybulk|finalize>`);
  process.exit(1);
}
handlers[cmd]().catch(err => { console.error(err); process.exit(1); });

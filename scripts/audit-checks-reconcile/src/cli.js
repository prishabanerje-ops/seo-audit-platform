#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './csv.js';
import { loadSeed } from './seed.js';
import { reconcile } from './reconcile.js';
import { writeCanonicalCsv } from './output/canonical-csv.js';
import { buildRunSummary, buildDryrunTable } from './output/summary-md.js';
import { buildBulkDecisions, parseBulkDecisions } from './output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from './output/individual-md.js';
import { buildRenameMap } from './output/rename-map-md.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const INPUT_CSV = join(PROJECT_ROOT, 'audit-replan-subchecks-comprehensive.csv');
const OUT_DIR = join(PROJECT_ROOT, 'docs', 'audit-checks');

async function ensureOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function loadInputs() {
  const csvText = await readFile(INPUT_CSV, 'utf8');
  const csvRows = await parseCsv(csvText);
  const seed = await loadSeed();
  return { csvRows, seed };
}

async function dryrun() {
  await ensureOutDir();
  const { csvRows, seed } = await loadInputs();
  const { rows } = reconcile({ csvRows, seed, limit: 25 });
  await writeFile(join(OUT_DIR, 'dryrun-25rows.md'), buildDryrunTable(rows));
  console.log('Dry-run table written to docs/audit-checks/dryrun-25rows.md');
}

async function fullpass() {
  await ensureOutDir();
  const { csvRows, seed } = await loadInputs();
  const { rows } = reconcile({ csvRows, seed });
  await writeFile(join(OUT_DIR, 'canonical-checks-v1.draft.csv'), await writeCanonicalCsv(rows));
  await writeFile(join(OUT_DIR, 'run-summary.md'), buildRunSummary(rows, { label: 'M3 full pass' }));
  await writeFile(join(OUT_DIR, 'triage-bulk-decisions.md'), buildBulkDecisions(rows));
  console.log('Full-pass artifacts written to docs/audit-checks/.');
  console.log('NEXT: edit triage-bulk-decisions.md (fill `Decision:` lines), then run `applybulk`.');
}

async function applybulk() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const bulkPath = join(OUT_DIR, 'triage-bulk-decisions.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const bulkText = await readFile(bulkPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const bulkAnswers = parseBulkDecisions(bulkText);

  for (const ans of bulkAnswers) {
    if (ans.decision === '___' || !ans.decision) continue;
    for (const row of draftRows) {
      if (row.decision !== 'flag') continue;
      if (row.rule_id !== ans.rule || row.category !== ans.category) continue;
      if (ans.decision === 'keep-all') { row.decision = 'keep'; row.rationale = `bulk-keep (${ans.rule})`; }
      else if (ans.decision === 'cut-all') { row.decision = 'cut'; row.rationale = `bulk-cut (${ans.rule})`; }
      // flag-individually keeps decision=flag for individual review
    }
  }

  await writeFile(draftCsvPath, await writeCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'triage-individual.md'), buildIndividualFlags(draftRows));
  console.log('Bulk decisions applied. Individual-flag file written.');
  console.log('NEXT: edit triage-individual.md (fill `Your call:` lines), then run `finalize`.');
}

async function finalize() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const individualPath = join(OUT_DIR, 'triage-individual.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const individualText = await readFile(individualPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const indivAnswers = parseIndividualFlags(individualText);

  for (const ans of indivAnswers) {
    if (!ans.check_id || !ans.decision || ans.decision === '___') continue;
    const row = draftRows.find(r => r.check_id === ans.check_id);
    if (!row) continue;
    if (ans.decision.startsWith('comment:')) {
      row.notes = (row.notes ? row.notes + '; ' : '') + ans.decision;
      row.decision = 'keep';
    } else if (['keep', 'cut', 'edit-and-keep'].includes(ans.decision)) {
      row.decision = ans.decision === 'edit-and-keep' ? 'edit' : ans.decision;
    }
    row.rationale = `individual triage (${ans.decision})`;
  }

  await writeFile(join(OUT_DIR, 'canonical-checks-v1.csv'), await writeCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'canonical-checks-v1.md'), buildRunSummary(draftRows, { label: 'M7 finalized' }));
  await writeFile(join(OUT_DIR, 'category-rename-map.md'), buildRenameMap());
  console.log('Finalized canonical CSV + companion docs written.');
  console.log('NEXT: review, then `git rm` drafts and commit per plan Task 23.');
}

const cmd = process.argv[2];
const handlers = { dryrun, fullpass, applybulk, finalize };
if (!handlers[cmd]) {
  console.error(`Usage: node src/cli.js <dryrun|fullpass|applybulk|finalize>`);
  process.exit(1);
}
handlers[cmd]().catch(err => { console.error(err); process.exit(1); });

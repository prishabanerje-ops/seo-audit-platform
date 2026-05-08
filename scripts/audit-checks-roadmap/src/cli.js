#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './csv.js';
import { runRoadmap } from './roadmap.js';
import { writeExtendedCanonicalCsv } from './output/canonical-csv.js';
import { buildRoadmapSummary } from './output/summary-md.js';
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
  const { rows } = await runRoadmap({ limit: 25 });
  await writeFile(join(OUT_DIR, 'roadmap-dryrun-25rows.md'), buildDryrunTable(rows));
  console.log('Dry-run table written to docs/audit-checks/roadmap-dryrun-25rows.md');
}

async function fullpass() {
  await ensureOutDir();
  const { rows } = await runRoadmap();

  // Merge annotated rows back into the full canonical CSV
  const allText = await readFile(CANONICAL_CSV, 'utf8');
  const allRows = parseCsv(allText);
  const byId = new Map(rows.map(r => [r.check_id, r]));
  const merged = allRows.map(r => {
    const upd = byId.get(r.check_id);
    return upd ? { ...r, priority: upd.priority, effort: upd.effort, roadmap_notes: upd.roadmap_notes } : r;
  });

  await writeFile(join(OUT_DIR, 'canonical-checks-v1.draft.csv'), writeExtendedCanonicalCsv(merged));
  await writeFile(join(OUT_DIR, 'roadmap-run-summary.md'), buildRoadmapSummary(rows, { label: 'R3 full pass' }));
  await writeFile(join(OUT_DIR, 'roadmap-bulk-decisions.md'), buildBulkDecisions(rows));
  console.log('Full-pass artifacts written to docs/audit-checks/.');
  console.log('NEXT: edit roadmap-bulk-decisions.md (fill `Decision:` lines), then run `applybulk`.');
}

async function applybulk() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const bulkPath = join(OUT_DIR, 'roadmap-bulk-decisions.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const bulkText = await readFile(bulkPath, 'utf8');
  const draftRows = parseCsv(draftCsvText);
  const bulkAnswers = parseBulkDecisions(bulkText);

  // Track which rows were flagged for individual review
  const flaggedIds = new Set();

  for (const ans of bulkAnswers) {
    if (!ans.decision || ans.decision === '___') continue;

    for (const row of draftRows) {
      if (row.priority !== ans.priority || row.category !== ans.category) continue;
      if (!row.priority || !row.effort) continue;  // skip out-of-scope rows

      if (ans.decision === 'accept') {
        // No-op; keep heuristic values
        continue;
      }
      if (ans.decision.startsWith('reshape:')) {
        const newP = ans.decision.split(':')[1].trim();
        if (['P0', 'P1', 'P2'].includes(newP)) {
          row.roadmap_notes = `${row.roadmap_notes}; bulk reshape: ${row.priority}→${newP} (${ans.category} group)`;
          row.priority = newP;
        }
        continue;
      }
      if (ans.decision === 'flag-individually') {
        flaggedIds.add(row.check_id);
        row.roadmap_notes = `${row.roadmap_notes}; bulk flag-individually`;
      }
    }
  }

  // Determine which rows go into individual.md: flagged ones, OR rows with PRIORITY-FLAG/EFFORT-FLAG
  const individualRows = draftRows.filter(r => {
    if (flaggedIds.has(r.check_id)) return true;
    const notes = r.roadmap_notes || '';
    return notes.includes('PRIORITY-FLAG') || notes.includes('EFFORT-FLAG');
  });

  await writeFile(draftCsvPath, writeExtendedCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'roadmap-individual.md'), buildIndividualFlags(individualRows));
  console.log(`Bulk decisions applied. ${individualRows.length} items routed to individual review.`);
  console.log('NEXT: edit roadmap-individual.md (fill `Your call:` lines), then run `finalize`.');
}

async function finalize() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const individualPath = join(OUT_DIR, 'roadmap-individual.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const individualText = await readFile(individualPath, 'utf8');
  const draftRows = parseCsv(draftCsvText);
  const indivAnswers = parseIndividualFlags(individualText);

  for (const ans of indivAnswers) {
    if (!ans.check_id || !ans.raw || ans.raw === '___') continue;
    const row = draftRows.find(r => r.check_id === ans.check_id);
    if (!row) continue;

    if (ans.comment !== undefined) {
      row.roadmap_notes = `${row.roadmap_notes}; comment: ${ans.comment}`;
      continue;
    }
    if (ans.priority) {
      row.roadmap_notes = `${row.roadmap_notes}; individual override: ${row.priority}→${ans.priority}`;
      row.priority = ans.priority;
    }
    if (ans.effort) {
      row.roadmap_notes = `${row.roadmap_notes}; individual override: effort ${row.effort}→${ans.effort}`;
      row.effort = ans.effort;
    }
  }

  // Promote draft to final canonical CSV
  await writeFile(CANONICAL_CSV, writeExtendedCanonicalCsv(draftRows));
  // Generate final summary (only the in-scope rows for the summary stats)
  // Embed the individual triage answers as a decision log appendix per spec §8
  const inScopeRows = draftRows.filter(r => r.priority && r.priority !== '');
  const summary = buildRoadmapSummary(inScopeRows, { label: 'R7 finalized' });
  const finalSummary = `${summary}\n## Decision log (individual triage answers)\n\n${individualText}`;
  await writeFile(join(OUT_DIR, 'roadmap-summary.md'), finalSummary);
  console.log('Finalized canonical CSV + roadmap-summary.md written.');
  console.log('NEXT: review, then `git rm` drafts and commit per plan Task 16.');
}

const cmd = process.argv[2];
const handlers = { dryrun, fullpass, applybulk, finalize };
if (!handlers[cmd]) {
  console.error(`Usage: node src/cli.js <dryrun|fullpass|applybulk|finalize>`);
  process.exit(1);
}
handlers[cmd]().catch(err => { console.error(err); process.exit(1); });

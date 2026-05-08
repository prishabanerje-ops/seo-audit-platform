import { jaccardScore } from './jaccard.js';

const FLAG_GAP = 0.1;        // top two priorities within this gap
const FLAG_MIN = 0.4;        // ...AND both above this threshold
const IMPL_P1 = 0.6;
const IMPL_P2 = 0.5;
const PARTIAL_P3 = 0.4;
const MISS_THRESHOLD = 0.3;

export function classifyRow(row, signals) {
  const canonicalName = row.name;
  // Best score per priority + the matching signal
  const bestPerPriority = {};
  for (const sig of signals) {
    const score = jaccardScore(canonicalName, sig.name);
    const cur = bestPerPriority[sig.priority];
    if (!cur || score > cur.score) {
      bestPerPriority[sig.priority] = { score, signal: sig };
    }
  }

  const get = (p) => bestPerPriority[p]?.score ?? 0;
  const sigOf = (p) => bestPerPriority[p]?.signal;

  const p1 = get(1);
  const p2 = get(2);
  const p3 = get(3);
  const p4 = get(4);
  const allScores = [p1, p2, p3, p4];
  const maxScore = Math.max(...allScores);

  // G-FLAG (a): top two priorities within 0.1 of each other and both ≥ 0.4
  // Compute top two distinct priorities
  const sortedPriorities = [1, 2, 3, 4]
    .map(p => ({ p, score: get(p) }))
    .sort((a, b) => b.score - a.score);
  if (
    sortedPriorities[0].score >= FLAG_MIN &&
    sortedPriorities[1].score >= FLAG_MIN &&
    Math.abs(sortedPriorities[0].score - sortedPriorities[1].score) <= FLAG_GAP
  ) {
    const top = sigOf(sortedPriorities[0].p);
    return {
      impl_status: 'flag',
      impl_location: top ? `${top.file}:${top.line}` : '',
      impl_evidence: top ? formatEvidence(top) : '',
      gap_notes: `G-FLAG: top two priorities within ${FLAG_GAP} (P${sortedPriorities[0].p}=${sortedPriorities[0].score.toFixed(2)}, P${sortedPriorities[1].p}=${sortedPriorities[1].score.toFixed(2)})`,
    };
  }

  // G-FLAG (b): canonical tokens overlap signals across ≥2 different signal_types
  // (only count when scores are comparable, i.e. each signal_type's best ≥ FLAG_MIN)
  const bestPerType = {};
  for (const sig of signals) {
    const score = jaccardScore(canonicalName, sig.name);
    if (score < FLAG_MIN) continue;
    const cur = bestPerType[sig.signal_type];
    if (!cur || score > cur.score) bestPerType[sig.signal_type] = { score, signal: sig };
  }
  if (Object.keys(bestPerType).length >= 2) {
    const types = Object.keys(bestPerType).join(',');
    const top = Object.values(bestPerType).sort((a, b) => b.score - a.score)[0].signal;
    return {
      impl_status: 'flag',
      impl_location: `${top.file}:${top.line}`,
      impl_evidence: formatEvidence(top),
      gap_notes: `G-FLAG: cross-type ambiguity (${types})`,
    };
  }

  // G-MAN: manual + no signal ≥ 0.3
  if (row.automation_type === 'manual' && maxScore < MISS_THRESHOLD) {
    return { impl_status: 'n-a', impl_location: '', impl_evidence: '', gap_notes: 'G-MAN: manual canonical, no signal match' };
  }

  // G-IMPL-1: P1 ≥ 0.6
  if (p1 >= IMPL_P1) {
    const s = sigOf(1);
    return {
      impl_status: 'implemented',
      impl_location: `${s.file}:${s.line}`,
      impl_evidence: formatEvidence(s),
      gap_notes: `G-IMPL-1: P1 score ${p1.toFixed(2)}`,
    };
  }

  // G-IMPL-2: P2 ≥ 0.5
  if (p2 >= IMPL_P2) {
    const s = sigOf(2);
    return {
      impl_status: 'implemented',
      impl_location: `${s.file}:${s.line}`,
      impl_evidence: formatEvidence(s),
      gap_notes: `G-IMPL-2: P2 score ${p2.toFixed(2)}`,
    };
  }

  // G-PARTIAL-1: P3 ≥ 0.4
  if (p3 >= PARTIAL_P3) {
    const s = sigOf(3);
    return {
      impl_status: 'partial',
      impl_location: `${s.file}:${s.line}`,
      impl_evidence: formatEvidence(s),
      gap_notes: `G-PARTIAL-1: P3 score ${p3.toFixed(2)} — extractor produces signal, no parser/service classifies`,
    };
  }

  // G-MISS: nothing above 0.3
  return { impl_status: 'missing', impl_location: '', impl_evidence: '', gap_notes: `G-MISS: max score ${maxScore.toFixed(2)} below threshold` };
}

function formatEvidence(sig) {
  const kind = sig.signal_type === 'issue-emitter' ? 'issueType' :
               sig.signal_type === 'service-function' ? 'function' :
               sig.signal_type === 'extractor-field' ? 'field' : 'signal';
  return `${kind}: '${sig.name}'`;
}

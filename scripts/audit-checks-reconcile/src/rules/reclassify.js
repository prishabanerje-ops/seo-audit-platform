const HYBRID_DETECTABLE = [
  /\bprivacy policy\b/i,
  /\bcontact (page|us)\b/i,
  /\babout (page|us)\b/i,
  /\bauthor (schema|page|byline|sameAs)\b/i,
  /\bphysical address\b/i,
  /\bterms of service\b/i,
  /\bsecure payment\b/i,
];

const GSC_KEYWORDS = [/\bsearch console\b/i, /\bGSC\b/i, /\bcoverage\b/i, /\bimpressions?\b/i, /\bpositions?\b/i, /\bclicks\b/i];
const GA4_KEYWORDS = [/\bGA4\b/i, /\borganic traffic\b/i, /\bsessions?\b/i, /\bbounce rate\b/i];

function appendNote(notes, addition) {
  return notes ? `${notes}; ${addition}` : addition;
}

export function reclassify(row) {
  const next = { ...row };
  // R-R1
  if (next.automation_type === 'manual' && HYBRID_DETECTABLE.some(rx => rx.test(next.name || ''))) {
    next.automation_type = 'hybrid';
    next.notes = appendNote(next.notes, 'reclassified manual→hybrid (crawler can detect presence)');
  }
  // R-R2
  if (next.automation_type === 'automated') {
    if (GSC_KEYWORDS.some(rx => rx.test(next.name || ''))) {
      next.notes = appendNote(next.notes, 'requires GSC');
    }
    if (GA4_KEYWORDS.some(rx => rx.test(next.name || ''))) {
      next.notes = appendNote(next.notes, 'requires GA4');
    }
  }
  // R-R3 is implicit: rows that don't match R-R1/R-R2 stay as-is.
  return next;
}

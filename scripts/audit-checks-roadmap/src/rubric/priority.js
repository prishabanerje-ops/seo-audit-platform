// See spec §5. Two-step rubric:
//   Step 1: base priority from severity (critical→P0, warning→P1, info→P2, default→P2 with flag)
//   Step 2: if impl_status=partial, promote one tier (warning→P0, info→P1; critical stays P0)
const BASE = {
  critical: { priority: 'P0', rule: 'R-BASE-CRITICAL' },
  warning:  { priority: 'P1', rule: 'R-BASE-WARNING'  },
  info:     { priority: 'P2', rule: 'R-BASE-INFO'     },
};

const PROMOTED = {
  critical: 'P0',  // already top
  warning:  'P0',
  info:     'P1',
};

export function computePriority({ severity, impl_status }) {
  const sev = String(severity || '').trim().toLowerCase();
  const isPartial = impl_status === 'partial';

  if (!BASE[sev]) {
    // Unknown / empty severity → P2 with flag
    return {
      priority: 'P2',
      rule: 'R-BASE-DEFAULT',
      note: `R-BASE-DEFAULT (no severity, defaulted to P2); PRIORITY-FLAG: empty severity`,
    };
  }

  if (isPartial) {
    const promoted = PROMOTED[sev];
    return {
      priority: promoted,
      rule: 'R-PROMO-PARTIAL',
      note: `R-PROMO-PARTIAL (partial+${sev}→${promoted})`,
    };
  }

  const base = BASE[sev];
  return {
    priority: base.priority,
    rule: base.rule,
    note: `${base.rule} (${sev}→${base.priority})`,
  };
}

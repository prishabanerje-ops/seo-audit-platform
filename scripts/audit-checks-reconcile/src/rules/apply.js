import { flagRules } from './flag.js';
import { cutRules } from './cut.js';
import { mergeRules } from './merge.js';
import { editRules } from './edit.js';

const ORDERED = [
  ...flagRules,    // F: short-circuit
  ...cutRules,     // C
  ...mergeRules,   // M
  ...editRules,    // E
];

export function applyRules(row, ctx) {
  for (const rule of ORDERED) {
    const result = rule.apply(row, ctx);
    if (result) return result;
  }
  return { decision: 'keep', rule_id: 'R-K', rationale: 'default' };
}

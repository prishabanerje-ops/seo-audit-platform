// backend/services/scoring.service.js
/**
 * Scoring model for the check engine.
 * Deduction-based: start at 100, subtract per failed check by severity.
 * Score is floored at 0.
 *
 * @typedef {Object} CheckResult
 * @property {string}  check_id
 * @property {boolean} passed
 * @property {'critical'|'warning'|'info'} severity
 * @property {string}  section
 * @property {string}  message
 * @property {string|null} details
 */

const WEIGHTS = { critical: 25, warning: 10, info: 1 };

/**
 * @param {CheckResult[]} checkResults
 * @returns {number} integer 0–100
 */
export function computePageScore(checkResults) {
  const deductions = checkResults
    .filter(r => !r.passed)
    .reduce((sum, r) => sum + (WEIGHTS[r.severity] ?? 0), 0);
  return Math.max(0, 100 - deductions);
}

/**
 * @param {CheckResult[]} checkResults
 * @param {string} section
 * @returns {number} integer 0–100
 */
export function computeSectionScore(checkResults, section) {
  return computePageScore(checkResults.filter(r => r.section === section));
}

/**
 * @param {CheckResult[]} checkResults
 * @returns {Record<string, number>} section name → score
 */
export function computeAllSectionScores(checkResults) {
  const sections = [...new Set(checkResults.map(r => r.section))];
  return Object.fromEntries(
    sections.map(s => [s, computeSectionScore(checkResults, s)])
  );
}

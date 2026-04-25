import { AUDIT_CHECKS } from '../../../backend/db/seed/audit-checks.js';

export async function loadSeed() {
  return AUDIT_CHECKS;
}

/**
 * @module services/audit-log.service
 * Best-effort helper to write an entry to the audit_log table.
 * Never throws — a failed log write must never fail the parent request.
 */
import db from '../db/sqlite.js';

/**
 * Record a superadmin action in the audit log.
 *
 * @param {object} actor        - req.user (must have .sub and .email)
 * @param {object} opts
 * @param {string} opts.action       - e.g. 'company.create', 'user.invite'
 * @param {string} [opts.targetType] - e.g. 'company', 'user'
 * @param {string} [opts.targetId]
 * @param {string} [opts.companyId]
 * @param {object} [opts.metadata]   - arbitrary JSON-serialisable object
 */
export function logAction(actor, { action, targetType = null, targetId = null, companyId = null, metadata = null }) {
  try {
    db.prepare(`
      INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, company_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actor.sub,
      actor.email,
      action,
      targetType,
      targetId,
      companyId,
      metadata ? JSON.stringify(metadata) : null,
      new Date().toISOString(),
    );
  } catch (_) {
    // Swallow — audit log is non-critical
  }
}

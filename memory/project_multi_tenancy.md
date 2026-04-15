---
name: Multi-tenancy architecture — Phase plan and decisions
description: All confirmed design decisions for superadmin + multi-tenancy feature across 3 phases
type: project
originSessionId: 614154b5-3830-4333-95d9-55542c47fa9e
---
Platform is being converted from single-tenant to multi-tenant. Phase 1 and Phase 2 are fully implemented (as of April 2026).

**Why:** Multiple companies will use the same shared instance. Full data isolation required per company.

## Confirmed decisions

- Single shared instance, `company_id` scoping on every query
- `companies` table is first-class (name, contact_email, domain, logo, max_seats, plan, is_paid, status)
- Exactly one superadmin — DB-enforced partial unique index + backend check
- Superadmin has no `company_id` (outside company concept)
- `is_paid` and `plan` are separate fields — plan is display label, is_paid gates access
- Access block at LOGIN only (not every API call) — existing sessions not force-expired
- Seat limit: hard 400 error at invite creation
- Logo: PNG/JPG/SVG/WebP, max 50KB, stored in `backend/uploads/logos/`
- Settings: Anthropic API key is global (superadmin). All other settings per-company (Phase 3).
- SMTP invite: falls back to showing URL on screen if SMTP not configured
- Impersonation: superadmin picks user from modal on Companies page; logs out to end; events logged in `audit_log`
- Company context switching: persisted in localStorage; header shows "Viewing: X" + dropdown switcher
- Audit Log: superadmin-only, under new "Admin" nav dropdown (Phase 2)

## Migration 006 seeds
- Cars24: contact_email=admin@c24.com, domain=cars24.com, max_seats=10, plan=Enterprise, is_paid=1
- aakash.srivastava@cars24.com → promoted to superadmin, company_id=NULL
- admin@c24.com → Cars24 admin, temp password: ChangeMe123!
- Fresh install default superadmin: superadmin@localhost / SuperAdmin123!

## Phase plan
- Phase 1 (foundation): ✅ COMPLETE — companies table, company_id on all tables, migration 006, auth scoping, JWT includes company_id, login is_paid check, seat limit enforcement
- Phase 2 (superadmin UI): ✅ COMPLETE — Companies page, company switcher header, impersonation modal, access expired screen, audit log page, Admin nav dropdown
- Phase 3 (per-company integrations): PENDING — per-company settings page, per-company GSC/GA4 OAuth, per-company Slack/Linear/SMTP

**How to apply:** Always scope backend queries by company_id. Never return data across company boundaries for non-superadmin users. PRD.md and README.md are updated to reflect Phase 1 design.

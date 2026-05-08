# Audit Checks Reconciliation Tool

One-shot tooling for Phase 1 of the canonical reconciliation. Produces docs only, no platform code is modified.

## Setup

    cd scripts/audit-checks-reconcile && npm install

## Milestone subcommands

    npm run cli -- dryrun       # M1: rubric on first 25 CSV rows
    npm run cli -- fullpass     # M3: full pass + seed reconciliation
    npm run cli -- applybulk    # M5: apply edited bulk-decisions.md, emit individual-flag file
    npm run cli -- finalize     # M7: apply edited individual.md, produce final CSV + companion docs

## Tests

    npm test

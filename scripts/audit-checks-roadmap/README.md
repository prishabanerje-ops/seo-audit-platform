# Audit Checks Roadmap Tool

Phase 3 of audit-checks reconciliation. Assigns priority (P0/P1/P2) and effort (S/M/L/XL) to the 163 in-scope canonical checks (149 missing + 14 partial). Produces docs only; no platform code is modified.

## Setup

    cd scripts/audit-checks-roadmap && npm install

## Milestone subcommands

    npm run cli -- dryrun       # R1: heuristic on first 25 in-scope rows
    npm run cli -- fullpass     # R3: full pass on all 163 rows
    npm run cli -- applybulk    # R5: apply edited bulk-decisions.md, emit individual-flag file
    npm run cli -- finalize     # R7: apply edited individual.md, produce final extended canonical CSV

## Tests

    npm test

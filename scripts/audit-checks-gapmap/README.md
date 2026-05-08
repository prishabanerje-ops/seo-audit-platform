# Audit Checks Gap-Map Tool

Phase 2 of audit-checks reconciliation. Classifies the 204 active csv-derived canonical checks as implemented / partial / missing / n-a against the platform implementation surface. Produces docs only, no platform code is modified.

## Setup

    cd scripts/audit-checks-gapmap && npm install

## Milestone subcommands

    npm run cli -- dryrun       # G1: heuristic on first 25 canonical rows
    npm run cli -- fullpass     # G3: full pass on remaining 179 rows
    npm run cli -- applybulk    # G5: apply edited bulk-decisions.md, emit individual-flag file
    npm run cli -- finalize     # G7: apply edited individual.md, produce final extended canonical CSV

## Tests

    npm test

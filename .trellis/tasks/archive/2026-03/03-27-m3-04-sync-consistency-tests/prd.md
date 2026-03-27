# M3-04: Sync consistency tests

## Goal
Add idempotency and LWW consistency tests for cross-device sync.

## Requirements
- Cover repeated sync uploads/pulls without duplicate amplification.
- Cover annotation conflict resolution using LWW rules.
- Validate mixed valid/invalid remote payload handling.

## Acceptance Criteria
- [x] Idempotency and LWW scenarios are automated in tests.
- [x] Sync regression cases fail when merge logic is broken.
- [x] Test reports are reproducible in local CI commands.

## Technical Notes
- Milestone: M3-04
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Extended `packages/sync-r2/test/sync-bundle.test.ts` with consistency matrix:
    - repeated bundle sync idempotency
    - annotation/report LWW tie-break behavior
    - mixed valid/invalid entry handling in remote payloads
  - Kept and validated backward compatibility test for legacy `syncDay` event-only behavior.
  - Added architecture note: `docs/architecture/m3-sync-consistency-tests.md`.
- Verification:
  - `pnpm --filter @timetracker/sync-r2 typecheck`
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

# M3-04 Sync Consistency Tests

## Goal

Add executable regression tests that lock sync consistency semantics for idempotency, LWW conflict resolution, and mixed payload quality.

## Coverage Added

File: `packages/sync-r2/test/sync-bundle.test.ts`

### 1) Idempotency under repeated sync

- Scenario: same device repeats upload/pull with unchanged events/annotations/reports.
- Assertion: merged outputs do not amplify duplicates; counts and payload identity remain stable.

### 2) Annotation/report LWW semantics

- Scenario: two devices write same logical target with equal `updatedAt` but different `updatedByDeviceId`.
- Assertion: tie-break follows lexical order of `updatedByDeviceId`, matching shared LWW contract.

### 3) Mixed valid/invalid remote payload handling

- Scenario: same remote object contains both valid and invalid entries.
- Assertion:
  - valid entries are kept and merged
  - invalid entries are dropped
  - invalid entry counters are incremented
  - object-level parse counters remain consistent

### 4) Backward compatibility guard (retained)

- Existing `syncDay` event-only path remains valid even with annotation/report objects present.

## Reproducible Commands

1. `pnpm --filter @timetracker/sync-r2 test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test`

All above pass with current implementation, providing CI-reproducible evidence.

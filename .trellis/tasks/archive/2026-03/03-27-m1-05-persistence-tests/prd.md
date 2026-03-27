# M1-05: Persistence test coverage

## Goal
Add persistence-focused test coverage for append/merge/LWW/reload scenarios.

## Requirements
- Cover event append and idempotent merge behavior with persistence round-trips.
- Cover annotation LWW merges across simulated concurrent updates.
- Cover reload correctness across restart-like cycles.

## Acceptance Criteria
- [x] Test suite includes append/merge/LWW/reload scenarios.
- [x] New tests fail on regression and pass on current implementation.
- [x] CI/local test commands pass for affected packages.

## Technical Notes
- Milestone: M1-05
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added executable persistence regression tests in `packages/core/test/persistence-roundtrip.test.ts`.
  - Covered append/idempotent merge behavior with restart-like repository reload.
  - Covered annotation LWW conflict resolution across reload boundaries.
  - Covered day query and summary consistency after reload.
  - Added `packages/core/tsconfig.test.json` and updated `@timetracker/core` test script to compile and run Node tests.
- Verification:
  - `pnpm --filter @timetracker/core test`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`

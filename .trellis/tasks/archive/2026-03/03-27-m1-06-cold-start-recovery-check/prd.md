# M1-06: Cold-start recovery check

## Goal
Provide reproducible cold-start recovery validation for desktop data consistency.

## Requirements
- Add a deterministic verification path for record -> close -> reopen -> verify.
- Validate both event timeline and annotation/category aggregates after restart.
- Capture expected behavior for normal and degraded startup cases.

## Acceptance Criteria
- [x] Cold-start verification can be executed repeatably.
- [x] Data consistency after restart is validated by script/test/doc.
- [x] Recovery edge cases are documented.

## Technical Notes
- Milestone: M1-06
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added desktop cold-start recovery integration tests in `apps/desktop/test/cold-start-recovery.test.ts`.
  - Added desktop test harness (`tsconfig.test.json`, runtime loader registration, and runner script).
  - Added architecture note documenting normal/degraded cold-start expectations.
- Recovery edge cases covered:
  - Corrupted events payload (`timetracker.desktop.events`)
  - Corrupted annotations payload (`timetracker.desktop.annotations`)
  - Corrupted storage metadata (`timetracker.desktop.storage.meta`)
  - Post-recovery write/read operability after quarantine
- Verification:
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`

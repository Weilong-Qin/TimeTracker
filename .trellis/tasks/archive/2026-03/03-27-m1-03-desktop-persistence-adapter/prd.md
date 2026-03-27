# M1-03: Desktop persistence adapter

## Goal
Implement desktop persistence adapter for events, annotations, and settings.

## Requirements
- Persist event log and annotation state across app restarts.
- Persist user settings needed for sync/report/push behavior.
- Integrate persistence adapter into desktop activity model lifecycle.

## Acceptance Criteria
- [x] Desktop data survives restart for tracked entities.
- [x] Persistence write/read errors are handled without app crash.
- [x] Integration behavior validated with regression checks.

## Technical Notes
- Milestone: M1-03
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added desktop local persistence repositories for events and annotations.
  - Added safe storage access helpers with in-memory fallback and parse quarantine behavior.
  - Integrated repository-backed store initialization into desktop activity model.
  - Prevented repeated seed insertion when persisted events already exist.
- Verification:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm lint`

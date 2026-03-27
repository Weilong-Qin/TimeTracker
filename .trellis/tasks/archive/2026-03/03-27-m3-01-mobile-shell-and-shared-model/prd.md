# M3-01: Mobile shell and shared model

## Goal
Build mobile MVP shell and connect shared domain model/state flow.

## Requirements
- Implement minimal mobile app shell for timeline/stat views.
- Reuse shared core contracts and aggregation logic where possible.
- Ensure mobile boot flow is stable for local-first usage.

## Acceptance Criteria
- [x] Mobile shell runs with shared model integration.
- [x] Core event/annotation contracts are reused consistently.
- [x] Basic mobile flow is testable end-to-end locally.

## Technical Notes
- Milestone: M3-01
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added `MobileShellModel` in `apps/mobile/src/model/mobile-shell.ts` for timeline/stats/pending view generation on top of shared `@timetracker/core` store/contracts.
  - Added local snapshot round-trip (`createSnapshot` / `fromSnapshot`) for restart-like local-first verification.
  - Updated mobile bootstrap entry to use shell model and expose shell readiness metrics.
  - Added mobile test harness and end-to-end local tests for shell integration, snapshot restore, and bootstrap path.
  - Added architecture note: `docs/architecture/m3-mobile-shell-and-shared-model.md`.
- Verification:
  - `pnpm --filter @timetracker/mobile typecheck`
  - `pnpm --filter @timetracker/mobile test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

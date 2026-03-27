# M2-07: Desktop offline beta gate

## Goal
Run offline end-to-end beta gate and resolve blocking defects.

## Requirements
- Define offline acceptance checklist for record/annotate/summarize/report.
- Execute checklist against desktop build with sync disabled.
- Track and close P0/P1 blockers for offline beta readiness.

## Acceptance Criteria
- [x] Offline beta checklist executes and results are recorded.
- [x] P0 blockers are resolved or explicitly deferred with rationale.
- [x] Desktop offline flow is stable for beta users.

## Technical Notes
- Milestone: M2-07
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added reusable sync-disabled gate executor (`executeDesktopSyncGate`) and wired desktop sync flow through it.
  - Added desktop offline beta gate integration test covering record/annotate/summarize/restart plus sync-disabled short-circuit.
  - Added reporting offline gate tests for AI fallback and no-target push skip behavior.
  - Added architecture/checklist record: `docs/architecture/m2-desktop-offline-beta-gate.md`.
- Verification:
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm --filter @timetracker/reporting test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

# M3-07: Beta hardening

## Goal
Run final beta hardening pass and clear remaining P0 blockers.

## Requirements
- Execute full regression checklist across desktop/mobile/sync/reporting.
- Fix high-severity blockers found during beta hardening.
- Prepare release readiness summary for beta handoff.

## Acceptance Criteria
- [x] P0 blockers are resolved or formally deferred.
- [x] Regression checklist passes on target beta scope.
- [x] Beta readiness summary is documented.

## Technical Notes
- Milestone: M3-07
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added executable beta hardening gate script: `scripts/beta-hardening.sh`.
  - Added root command entry: `pnpm run beta:hardening`.
  - Executed hardening gate and confirmed pass across core/reporting/sync-r2/mobile/desktop + workspace checks.
  - Added beta readiness summary and blocker table: `docs/architecture/m3-beta-hardening-summary.md`.
- Verification:
  - `pnpm run beta:hardening`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

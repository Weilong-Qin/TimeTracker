# M2-05: Timeline and inbox UX

## Goal
Improve timeline and pending inbox UX for faster classification workflows.

## Requirements
- Reduce steps to classify or reclassify resource activities.
- Improve interaction clarity for per-event and batch actions.
- Preserve existing annotation and rule-application semantics.

## Acceptance Criteria
- [x] Main classification flow can be completed in <=3 user steps.
- [x] Batch inbox actions remain accurate for target resources.
- [x] UX changes do not regress core timeline functionality.

## Technical Notes
- Milestone: M2-05
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added quick category + quick tag actions for event-level classification.
  - Added inbox suggestion + preset batch apply path for one-click/low-click processing.
  - Preserved manual edit path and existing save/apply contracts.
  - Updated UI copy to clarify fast-path classification steps.
  - Added architecture note documenting UX step targets and compatibility constraints.
- Verification:
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm --filter @timetracker/desktop lint`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`

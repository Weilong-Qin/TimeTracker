# M2-06: Stats charts v1

## Goal
Deliver first chart set for natural vs stacked duration and category distribution.

## Requirements
- Add chart components for category and duration summaries.
- Clearly distinguish natural duration and stacked duration semantics.
- Ensure chart data remains consistent with source summaries.

## Acceptance Criteria
- [x] At least two useful charts are rendered for daily insights.
- [x] Natural vs stacked semantics are explicit in UI copy.
- [x] Chart values match computed summary metrics.

## Technical Notes
- Milestone: M2-06
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added `DurationSemanticsChart` for day-level natural vs stacked comparison and overlap multiplier.
  - Added `CategoryDistributionChart` with per-category stacked/natural dual-track bars.
  - Switched chart source data to `summary.byPrimaryCategory` from `store.summarizeDay(day)` to guarantee metric consistency.
  - Added architecture note: `docs/architecture/m2-stats-charts-v1.md`.
- Verification:
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm --filter @timetracker/desktop lint`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

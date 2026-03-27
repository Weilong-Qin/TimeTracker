# M3-05: Report history persistence

## Goal
Persist daily/weekly/monthly reports and expose history retrieval.

## Requirements
- Add persistent model for generated and edited report entries.
- Add retrieval/list support for historical reports.
- Keep report editing flow compatible with persistence layer.

## Acceptance Criteria
- [x] Generated/edited reports are stored and recoverable after restart.
- [x] Users can retrieve recent report history reliably.
- [x] Report persistence does not block core tracking workflows.

## Technical Notes
- Milestone: M3-05
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added reusable report history persistence module (`apps/desktop/src/lib/report-history.ts`) supporting:
    - daily/weekly/monthly report ids
    - storage parse/stringify
    - upsert and retrieval sorting
  - Integrated report history state into desktop activity model:
    - `activeReportId`, `reportHistory`, `openReportHistory`
    - editor save persists to active report entry
    - day switch defaults to `daily:<day>` entry
  - Added report history retrieval UI in desktop app for loading recent entries.
  - Added report history persistence tests:
    - restart-like recoverability
    - reliable recent history retrieval for daily/weekly/monthly
  - Added architecture note: `docs/architecture/m3-report-history-persistence.md`.
- Verification:
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

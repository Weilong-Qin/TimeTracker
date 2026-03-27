# M3-03: Sync annotations and reports

## Goal
Extend sync channels to include annotations and report artifacts.

## Requirements
- Define sync representation for annotations and report data.
- Merge synced annotation/report data with existing local state.
- Keep event sync behavior backward compatible.

## Acceptance Criteria
- [x] Annotation/report sync payloads are transferred and merged correctly.
- [x] Cross-device data remains consistent after sync.
- [x] Existing event sync behavior is preserved.

## Technical Notes
- Milestone: M3-03
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Extended `@timetracker/sync-r2` key model with annotation/report channels:
    - `YYYY-MM-DD/<device-id>.annotations.json`
    - `YYYY-MM-DD/<device-id>.reports.json`
  - Added annotation/report push/pull API and `syncDayBundle(...)` for event + annotation + report artifact sync.
  - Added report artifact LWW merge (`mergeReportArtifacts`) aligned with annotation LWW semantics.
  - Integrated desktop sync flow with bundle sync and local merged report artifact state.
  - Added sync-r2 runtime tests for cross-device bundle merge, backward compatibility of `syncDay`, and malformed payload tolerance.
  - Added architecture note: `docs/architecture/m3-sync-annotations-and-reports.md`.
- Verification:
  - `pnpm --filter @timetracker/sync-r2 typecheck`
  - `pnpm --filter @timetracker/sync-r2 test`
  - `pnpm --filter @timetracker/desktop typecheck`
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

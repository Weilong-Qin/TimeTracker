# M1-04: Migration and recovery

## Goal
Implement data migration flow and corruption recovery policy for local storage.

## Requirements
- Add storage version detection and migration execution flow.
- Define fallback behavior for unknown or corrupted data files.
- Ensure partial failures do not break core read path.

## Acceptance Criteria
- [x] Older data versions can migrate to current schema.
- [x] Corrupted records are isolated with actionable diagnostics.
- [x] Recovery strategy keeps the app operational.

## Technical Notes
- Milestone: M1-04
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added storage meta payload with schema version and migration timestamps.
  - Added `runDesktopStorageMigrations` boot-time migration flow.
  - Added `v0 -> v1` migration handlers for events and annotations.
  - Added corruption isolation path by quarantining invalid payloads and continuing with defaults.
  - Hooked migration execution into desktop activity model storage bootstrap.
- Verification:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm lint`

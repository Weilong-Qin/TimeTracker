# M2-04: Project root attribution

## Goal
Implement project-root attribution for development activity classification.

## Requirements
- Derive project root identity from coding activity signals.
- Prioritize project root over app name for development attribution.
- Keep fallback path for non-project activities.

## Acceptance Criteria
- [x] Project activity aggregates by project root key.
- [x] Existing classification remains correct for non-project events.
- [x] Resource model stays backward compatible.

## Technical Notes
- Milestone: M2-04
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added editor-title based project root attribution helper in capture provider.
  - Updated desktop window capture to emit `resourceKind: project` when coding title signals are detected.
  - Kept app-level fallback unchanged for non-project window activities.
  - Added tests for attribution parsing and project-priority window capture behavior.
  - Added architecture note documenting attribution rule and compatibility guarantees.
- Verification:
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`

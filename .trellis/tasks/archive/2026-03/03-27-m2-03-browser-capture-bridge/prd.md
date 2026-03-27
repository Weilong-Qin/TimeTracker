# M2-03: Browser capture bridge MVP

## Goal
Bridge browser URL/title capture into resourceKey/resourceTitle model.

## Requirements
- Collect browser URL/title signals for active browsing activity.
- Normalize browser data into existing resource-centric event contracts.
- Preserve privacy-safe behavior and explicit opt-in boundaries.

## Acceptance Criteria
- [x] Browser activity is represented with resourceKey/resourceTitle fields.
- [x] Integration does not break non-browser capture paths.
- [x] Validation covers malformed or unavailable browser data.

## Technical Notes
- Milestone: M2-03
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added browser bridge snapshot parsing and normalization in capture provider.
  - Added optional bridge snapshot getter path in browser provider runtime.
  - Added explicit bridge opt-in key and snapshot storage key.
  - Kept fallback path to target browser location/title when bridge payload is inactive/invalid.
  - Added provider tests for valid bridge payload, malformed payload, and fallback behavior.
  - Added architecture note documenting bridge data contract and safety boundaries.
- Verification:
  - `pnpm --filter @timetracker/desktop test`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`

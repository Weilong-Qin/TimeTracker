# M1-02: Core store/repository split

## Goal
Refactor core store interfaces so in-memory and persistent backends are interchangeable.

## Requirements
- Introduce clear repository/store interfaces for events and annotations.
- Preserve existing domain behavior while decoupling storage implementation.
- Keep integration points stable for desktop and mobile consumers.

## Acceptance Criteria
- [x] In-memory and persistent store implementations can be swapped without app-layer changes.
- [x] Existing merge/LWW behavior remains unchanged.
- [x] Affected typecheck/tests pass.

## Technical Notes
- Milestone: M1-02
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Introduced repository interfaces for events and annotations.
  - Added repository-backed store implementation and kept `InMemoryActivityStore` as compatibility wrapper.
  - Switched desktop hook store reference to `ActivityStore` interface.
- Verification:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm lint`

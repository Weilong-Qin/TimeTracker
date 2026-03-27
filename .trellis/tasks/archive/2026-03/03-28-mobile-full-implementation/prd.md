# Complete Mobile Implementation

## Goal
Turn `apps/mobile` from model-only shell into a runnable mobile-oriented React application with core tracking workflows aligned to shared domain contracts.

## Requirements
- Build a real UI entry for `apps/mobile` using React + Vite.
- Provide manual activity entry flow (title + duration + optional category/tags/note).
- Provide annotation editing flow for existing events.
- Provide day-based timeline, pending inbox, and summary panels from shared model data.
- Support importing/exporting local snapshot JSON for persistence simulation.
- Keep mobile logic on top of `@timetracker/core` shared contracts and existing `MobileShellModel`.
- Add/adjust tests for new mobile behaviors where appropriate.

## Acceptance Criteria
- [ ] `apps/mobile` has runnable dev/build scripts and React runtime dependencies.
- [ ] User can add manual entry and see timeline/stats update immediately.
- [ ] User can edit annotation and see pending inbox / summary react accordingly.
- [ ] Snapshot export creates valid JSON and snapshot import restores data.
- [ ] `pnpm --filter @timetracker/mobile typecheck` passes.
- [ ] `pnpm --filter @timetracker/mobile test` passes.

## Technical Notes
- Reuse desktop-level implementation conventions where feasible but keep mobile UI lightweight.
- Treat "complete mobile" as MVP-complete within current local-first architecture (no native packaging in this task).

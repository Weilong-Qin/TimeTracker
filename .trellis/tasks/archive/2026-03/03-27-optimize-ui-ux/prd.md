# Brainstorm: Optimize UI/UX

## Goal

Improve the desktop app UI/UX by prioritizing daily operational flow first, modernizing visual hierarchy, and strengthening status feedback, while keeping existing feature behavior and contracts stable.

## What I already know

- User request: optimize UI/UX.
- Repository contains desktop and mobile apps, with frontend source under `apps/desktop/src` and `apps/mobile/src`.
- No specific target screen or pain point has been provided yet.
- Desktop UI is currently a single-page React layout in `apps/desktop/src/App.tsx` with many panels:
  - capture controls and date/device context
  - stats cards and two chart sections
  - R2 sync settings
  - AI report + push settings and history
  - manual entry
  - pending inbox
  - event timeline
- Mobile app currently has model/bootstrap code only (no comparable interactive UI surface yet).
- Existing architecture docs indicate timeline + inbox UX has already been improved for 1-step / 2-step / 3-step classification paths.

## Assumptions (temporary)

- Primary target is desktop app UX unless user specifies otherwise.
- Optimization should focus on existing desktop screens rather than a complete redesign.
- Current behavior and data contracts should remain compatible.
- We should prioritize one UX slice first to keep changes testable and reversible.

## Open Questions

- (none blocking)

## Requirements (evolving)

- Identify current UI/UX pain points for selected scope.
- Propose and implement an incremental improvement plan.
- Keep implementation aligned with existing architecture and tests.
- MVP focus is combination of:
  - Information architecture optimization (reorder page hierarchy, emphasize daily operational flow first).
  - Visual consistency optimization (typography scale, spacing rhythm, contrast, button/card consistency).
- Expansion choice included:
  - Keep scope focused on current requirement (no extra feature flows beyond UI/UX refinement).
  - Add robustness feedback improvements for key async states (sync/report generation/push): stronger loading/disabled/error/success hierarchy in UI.
- Keep existing feature contracts and behavior unchanged; this is UX/UI optimization, not feature redesign.
- Reorder desktop page sections so users see "today context + key daily operations" first and advanced settings second.
- Move sync/report/push configuration into secondary collapsible modules to reduce first-screen complexity.
- Apply a cleaner modern visual style:
  - stronger typographic hierarchy
  - consistent spacing system
  - cleaner panel/chip/button/input styling
  - reduced decorative noise versus current style
- Improve robustness feedback visuals for async actions:
  - clearer loading state emphasis for sync/report actions
  - clearer success/failure status readability (color hierarchy + wording visibility)

## Acceptance Criteria (evolving)

- [ ] Target screen(s) and UX goals are clearly defined.
- [ ] Primary daily workflow sections appear before advanced configuration sections.
- [ ] UI hierarchy is clearer via consistent typography, spacing, and visual grouping.
- [ ] Key async operations have clearer state feedback (processing / success / failure emphasis).
- [ ] Existing core workflows continue to work correctly.
- [ ] Relevant checks/tests pass.

## Definition of Done (team quality bar)

- Tests added/updated where appropriate
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Technical Approach

- Keep state/data logic in `useActivityModel` unchanged.
- Refactor `App.tsx` section order and lightweight view-only structure:
  - Introduce a primary operations area (stats, manual entry, inbox, timeline, category chart).
  - Move sync/report/push settings into secondary collapsible panels.
- Update `styles.css` tokens and component styles to a modern, cleaner system while preserving responsive behavior.
- Add explicit status visual variants in UI classes for async states without changing backend or hook contracts.

## Decision (ADR-lite)

**Context**: User requested "optimize UI/UX" with broad scope; there are many valid directions.

**Decision**: For MVP, use `1+4` (information architecture + visual consistency), include expansion `1+3` (keep scope focused + add robustness feedback), and choose visual direction `2` (cleaner modern style).

**Consequences**:
- Pros:
  - Fast delivery with visible UX impact and low regression risk.
  - Improves first-use clarity by reducing settings noise in primary workflow.
  - Better status readability for sync/report operations.
- Cons:
  - No deep interaction model redesign in this iteration.
  - Some advanced users may need one extra click to access settings.

## Out of Scope (explicit)

- Full product redesign across all pages in one iteration
- Large architecture rewrites unrelated to selected UI scope
- Introducing unrelated feature work
- Changing data contracts in `@timetracker/core`, `@timetracker/reporting`, or `@timetracker/sync-r2`
- Rewriting capture/sync/report business logic

## Technical Notes

- Task created via `.trellis/scripts/task.py create`.
- Inspected files:
  - `apps/desktop/src/App.tsx` (main UI composition and interaction surfaces)
  - `apps/desktop/src/styles.css` (design tokens, layout grid, component styles)
  - `apps/mobile/src/main.ts` and `apps/mobile/src/model/mobile-shell.ts` (mobile scope reality check)
  - `docs/architecture/m2-timeline-inbox-ux.md` (existing timeline/inbox UX goals)
  - `docs/architecture/pr2-capture-ui.md` (desktop UI baseline scope)
- Current UI risks/opportunities:
  - App page is feature-rich but dense; cognitive load is high when first opening.
  - Settings-heavy blocks (sync/report/push) compete visually with daily operational flows (inbox/timeline/manual).
  - Strong opportunity to improve information hierarchy and interaction focus without changing backend contracts.
- User choice recorded:
  - Selected direction: `1 + 4`
  - Meaning: prioritize information architecture + visual consistency in first iteration.
  - Expansion choice: `1 + 3`
  - Meaning: keep MVP scoped while adding stronger robustness/status feedback.
  - Visual direction: `2`
  - Meaning: move to cleaner modern style.
- Task workflow Phase 2 readiness:
  - Code-spec depth check: no API/schema/infra signature change expected for this MVP.
  - Primary files to modify:
    - `apps/desktop/src/App.tsx`
    - `apps/desktop/src/styles.css`

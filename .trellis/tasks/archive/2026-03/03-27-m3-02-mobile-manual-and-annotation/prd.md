# M3-02: Mobile manual and annotation flow

## Goal
Implement mobile manual entry and annotation workflow.

## Requirements
- Add mobile manual event entry for off-device activities.
- Add mobile annotation editing with primary category + tags model.
- Ensure edits integrate with existing merge/LWW semantics.

## Acceptance Criteria
- [x] Mobile users can create manual entries and annotate events.
- [x] Annotation payloads conform to shared contracts.
- [x] Updated data appears correctly in mobile summaries.

## Technical Notes
- Milestone: M3-02
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Implemented:
  - Added mobile manual entry + annotation draft workflow (`addManualEntryWithAnnotation`) for off-device activities.
  - Added annotation editor save path (`saveAnnotationDraft`) with primary category + tags(raw) + note normalization to shared `Annotation` shape.
  - Added mobile remote-annotation merge hook (`mergeRemoteAnnotations`) to reuse shared LWW semantics.
  - Expanded bootstrap flow to exercise manual creation + annotation edit on mobile shell.
  - Added architecture note: `docs/architecture/m3-mobile-manual-and-annotation-flow.md`.
- Verification:
  - `pnpm --filter @timetracker/mobile typecheck`
  - `pnpm --filter @timetracker/mobile test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

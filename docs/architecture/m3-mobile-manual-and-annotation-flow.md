# M3-02 Mobile Manual and Annotation Flow

## Goal

Implement mobile-side manual entry and annotation editing workflow on top of shared domain contracts.

## Flow Additions

File: `apps/mobile/src/model/mobile-shell.ts`

### Manual Entry

- Added `addManualEntryWithAnnotation(...)` to support off-device activity creation.
- Manual entry still uses shared `createManualEntry` contract from `@timetracker/core`.
- Optional annotation draft can be attached at creation time.

### Annotation Editing

- Added `saveAnnotationDraft(...)` for primary category + tags(raw) + note editing.
- Tags are normalized from comma-separated draft input.
- Payload shape remains shared `Annotation` contract:
  - `primaryCategory?`
  - `tags: string[]`
  - `note?`
  - `updatedAt`
  - `updatedByDeviceId`

### LWW Merge Integration

- Added `mergeRemoteAnnotations(...)` to route sync-like updates through shared merge path.
- Reuses core LWW resolution behavior (`updatedAt` first, then device id lexical tie-break).

## Summary Consistency

`getView(day)` remains the single mobile projection for:

- timeline (`event + annotation`)
- pending inbox (`buildPendingInbox`)
- summary (`stackedMs`, `naturalMs`, `byPrimaryCategory`)

After manual/annotation edits, summary values are computed from the same shared store and update immediately.

## Verification

Executable tests in `apps/mobile/test/mobile-shell.test.ts` cover:

1. manual entry + annotation creation flow
2. annotation edit payload normalization
3. LWW merge semantics in mobile flow
4. summary/category updates after edits

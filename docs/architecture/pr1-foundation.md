# PR1 Foundation: Local-First Time Tracking Scaffold

## Scope

This PR1 lays down the project foundation for the Time Tracker app:

- Monorepo workspace scaffold (`apps/*`, `packages/*`)
- Core domain contracts for activity events and annotations
- Local in-memory store with append-only event merge semantics
- Batch inbox primitives for uncategorized records
- Rule-based annotation helpers for bulk classification
- R2 sync contract stubs (`day/device` object key model + scheduler)
- Desktop/mobile bootstrap entry files proving single-device flow compiles

## Implemented Contracts

### ActivityEvent

- `eventId` (idempotency key)
- `deviceId`
- `resourceKind`
- `resourceKey`
- `resourceTitle?`
- `startedAt` / `endedAt` in milliseconds
- `source` (`auto` | `manual`)

### Annotation (LWW)

- `primaryCategory?` (single primary category)
- `tags: string[]` (multi-tag)
- `note?`
- `updatedAt`
- `updatedByDeviceId`

### Sync Object Path

- Pattern: `YYYY-MM-DD/<device-id>.ndjson`
- Parsing + validation helpers in `@timetracker/sync-r2`

## Current Limitations

- Event store is in-memory for now (persistent local DB in later PR)
- R2 client upload/download not implemented yet (contract-only)
- UI not implemented yet (only bootstrap app entry modules)

## Next PR Targets

- PR2: capture pipeline + manual fill + batch inbox labeling flow
- PR3: real R2 sync engine (upload/pull/merge/schedule)
- PR4: AI recap + webhook/bot push adapters (plain text)

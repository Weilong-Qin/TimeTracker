# M1-01 Local Persistence ADR and Schema

## Status

Accepted (2026-03-27)

## Context

Current behavior is local-first but largely in-memory for activity and annotation data.
Settings are partially persisted in browser `localStorage`.
To unlock M1-M3 milestones, persistence contracts must be explicit before adapter work starts.

## Decision Summary

1. Use a storage adapter boundary with a backend-agnostic logical schema.
2. Keep `ActivityEvent` append-only semantics and idempotent merge by `eventId`.
3. Persist four domains: events, annotations, settings, reports.
4. Version persistence with a global `schemaVersion` and ordered, idempotent migrations.
5. Prefer fail-open startup behavior: isolate corrupted payloads and keep core flows usable.

## Logical Data Domains

### 1) Events (append-only shards)

- Namespace: `events:<YYYY-MM-DD>`
- Payload: NDJSON of `ActivityEvent`
- Merge semantics: `eventId` idempotent dedupe, chronological sort (existing `mergeEventBatches`)

### 2) Annotations (LWW map)

- Namespace: `annotations`
- Payload: JSON object keyed by `eventId`
- Value contract: `Annotation`
- Conflict rule: last write wins by `updatedAt`, then `updatedByDeviceId` lexical tiebreak

### 3) Settings

- Namespace: `settings`
- Payload: JSON object
- Sections:
  - `device`: device identity
  - `sync`: sync settings
  - `report`: AI report settings
  - `push`: push target settings

### 4) Reports

- Namespace: `reports`
- Payload: JSON object keyed by report id
- Report id format:
  - Daily: `daily:YYYY-MM-DD`
  - Weekly: `weekly:YYYY-Www`
  - Monthly: `monthly:YYYY-MM`
- Value includes:
  - `periodType`: `daily | weekly | monthly`
  - `periodKey`
  - `generatedAt`
  - `updatedAt`
  - `source`: `ai | fallback | manual`
  - `content`

## Global Metadata

Namespace: `meta`

```json
{
  "schemaVersion": 1,
  "createdAt": 0,
  "updatedAt": 0,
  "lastMigrationAt": 0
}
```

## Storage Adapter Contract (v1)

```ts
interface LocalPersistenceAdapter {
  read(namespace: string): Promise<string | null>;
  write(namespace: string, payload: string): Promise<void>;
  remove(namespace: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
```

Notes:
- This is a logical contract for M1 planning; concrete TypeScript interfaces land in M1-02.
- Browser and desktop backends may store data differently, but must preserve namespace semantics.

## Versioning and Migration Contract

1. Read `meta.schemaVersion`; default to `0` when missing.
2. Run migrations sequentially: `v0->v1`, `v1->v2`, ... until target.
3. Each migration must be:
  - deterministic
  - idempotent (safe to rerun)
  - side-effect scoped (no unrelated namespace writes)
4. Only update `meta.schemaVersion` after all migration steps succeed.

## Recovery and Error Matrix

| Failure Case | Detection | Behavior | User-Facing Status |
| --- | --- | --- | --- |
| Missing namespace payload | `read(...) === null` | Initialize defaults for namespace | `initialized default storage` |
| Corrupted NDJSON line in events shard | parse failure per line | Skip bad lines, keep valid events, count invalid | `event shard partially recovered` |
| Corrupted annotations/settings/reports JSON | JSON parse failure | Move raw payload to quarantine namespace and re-init defaults | `storage recovered with reset for <namespace>` |
| Migration step failure | thrown error | Abort version bump, keep previous schemaVersion, preserve raw data | `migration failed, fallback to previous schema` |
| Write failure | adapter throws | Return explicit error and avoid silent success | `persistence write failed` |

## Good/Base/Bad Validation Cases

- Good:
  - Two devices sync same events; local reload preserves merged and deduped timeline.
  - Annotation updated on two devices; persisted result follows LWW contract.
- Base:
  - No sync configured; event/annotation/report flows still persist and reload locally.
- Bad:
  - One events shard contains invalid lines; valid lines still load and are counted.
  - `settings` payload is malformed JSON; app recovers defaults and reports recovery status.

## Out of Scope (M1-01)

- Concrete backend implementation (M1-03)
- Runtime migration executor code (M1-04)
- Persistence test suite implementation (M1-05)

## Follow-up Tasks

- M1-02: codify repository/store interfaces for swappable persistence backends
- M1-03: implement desktop persistence adapter using this schema
- M1-04: implement migration and recovery runtime

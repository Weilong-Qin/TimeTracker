# M4-02 Sync Partial Object Append Optimization

## Goal

Reduce event sync write amplification by replacing full device-day overwrite with delta append shards.

## Previous Behavior

- `syncDay` executed: `push full local device events -> pull all day events`.
- Each sync rewrote full `YYYY-MM-DD/<device-id>.ndjson`, even when no new local events existed.

## New Behavior

- `syncDay` executes: `pull day events -> compute local missing delta -> append delta shard`.
- Delta selection is event-id based:
  - local events are normalized/deduped
  - only events missing from pulled remote set are appended
- Append shard key format:
  - `YYYY-MM-DD/<device-id>/<timestamp>-<entropy>.ndjson`

## Compatibility

- Pull path still scans all `.ndjson` objects under `day/` prefix.
- Legacy shard keys (`YYYY-MM-DD/<device-id>.ndjson`) remain readable.
- `syncDayBundle` remains compatible because it reuses `syncDay`.

## Validation

- Added regression test: unchanged local state does not create new event object writes on repeated sync.
- Added regression test: adding one new local event creates exactly one extra append shard.
- Full workspace checks passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

## Follow-up (Out of Scope Here)

- Append-shard compaction/GC strategy for long-lived days.
- Optional push order tuning under high-concurrency write bursts.

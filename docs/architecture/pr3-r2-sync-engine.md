# PR3 R2 Sync Engine

## Scope Delivered

This PR3 slice implements an executable R2 sync layer on top of the PR1/PR2 domain contracts.

- Real S3-compatible client creation for Cloudflare R2
- Day + device shard write (`YYYY-MM-DD/<device-id>.ndjson`)
- Day-level object listing + pull + NDJSON decode
- Merge pipeline with idempotent event dedupe
- Desktop-side sync settings state and manual/interval sync trigger

## Engine API

- `pushDayShard(settings, day, deviceId, localDeviceEvents)`
- `pullDayEvents(settings, day)`
- `syncDay(settings, day, deviceId, localDeviceEvents)`

## Runtime Behaviors

- Sync disabled: UI reports `sync disabled`, no network call
- Sync enabled: day shard uploaded, then day prefix pulled and merged
- Invalid lines in remote NDJSON: skipped and counted
- Invalid settings: rejected with actionable error

## Deferred

- Background retry queue and exponential backoff
- Partial object append optimization
- End-to-end encryption for synced payloads

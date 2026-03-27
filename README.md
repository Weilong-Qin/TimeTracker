# TimeTracker

Cross-device time tracking and AI recap app (desktop + mobile), built with a local-first architecture and optional user-managed sync.

## Workspace Layout

- `apps/desktop`: desktop app entry scaffold
- `apps/mobile`: mobile app entry scaffold
- `packages/core`: shared domain model and local event store
- `packages/sync-r2`: R2 sync contracts and scheduler helpers
- `packages/reporting`: optional AI report and push adapters
- `docs/architecture`: architecture notes

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @timetracker/desktop dev
```

## Current Status

This repository currently includes PR1 foundation code:

- event and annotation contracts
- append-only merge and idempotent event handling
- summary aggregation primitives (natural vs stacked)
- R2 key model for day/device NDJSON shards

Current desktop app includes:

- timeline and pending inbox UI
- manual annotation and batch rule application
- mock capture pipeline with parallel event simulation
- executable R2 sync settings + sync trigger path
- optional AI report generation (with local fallback template)
- optional report push adapters (Webhook / DingTalk / Feishu)

Real capture adapters and persistent local DB are planned for subsequent PRs.

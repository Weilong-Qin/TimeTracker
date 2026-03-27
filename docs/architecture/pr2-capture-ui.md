# PR2 Capture + UI Baseline

## Scope Delivered

This PR2 slice introduces a working desktop UI and capture pipeline simulation on top of PR1 contracts.

- Vite + React desktop app shell
- Auto-capture mock pipeline with overlapping events (parallel activity)
- Timeline view with resource-level rows
- Batch inbox for uncategorized records
- Rule-based bulk classification from inbox
- Per-event manual annotation (single primary category + multi-tags)
- Manual entry form for off-device activity

## UX Notes

- Classification is resource-centric, not app-centric
- Pending inbox groups by `resourceKind + resourceKey`
- Summary highlights both natural duration and stacked duration

## Deferred to next slices

- Real OS/browser capture adapters
- Persistent local database (current store is in-memory)
- Real R2 push/pull sync execution
- AI report generation and external push adapters

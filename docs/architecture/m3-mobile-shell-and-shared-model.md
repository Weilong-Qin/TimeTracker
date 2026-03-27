# M3-01 Mobile Shell and Shared Model

## Goal

Deliver a minimal mobile MVP shell that reuses shared core contracts and can be tested locally end-to-end.

## Shell Model

File: `apps/mobile/src/model/mobile-shell.ts`

`MobileShellModel` wraps shared `InMemoryActivityStore` and exposes mobile-facing operations:

- `addManualEntry(...)`: create and append manual activity events
- `annotateEvent(...)`: upsert annotation with shared LWW metadata fields
- `getView(day)`: produce mobile shell view with:
  - timeline entries (`event + annotation`)
  - pending inbox list (`buildPendingInbox`)
  - summary stats (`stackedMs`, `naturalMs`, `byPrimaryCategory`)
- `createSnapshot()` / `fromSnapshot(...)`: local snapshot round-trip for restart-like local flow

## Shared Contract Reuse

This slice reuses existing contracts from `@timetracker/core` directly:

- `ActivityEvent`, `Annotation`, `PendingInboxItem`, `CategorySummary`
- `InMemoryActivityStore`
- `createManualEntry`
- `buildPendingInbox`

No mobile-local duplicate contracts were introduced.

## Mobile Bootstrap Entry

File: `apps/mobile/src/main.ts`

- Bootstraps shell via `bootstrapMobileShell(...)`
- Prints shell readiness summary (timeline count, pending count, stacked/natural metrics)
- Keeps `NODE_ENV === test` guard to avoid side effects in tests

## Testability and Local-First Readiness

Added executable mobile test harness:

- `apps/mobile/tsconfig.test.json`
- `apps/mobile/test/run-tests.sh`
- `apps/mobile/test/mobile-shell.test.ts`
- `apps/mobile/test/register-loader.mjs`
- `apps/mobile/test/core-loader.mjs`

Validation coverage:

1. Shared-contract integration for timeline + stats
2. Snapshot restore consistency for summary + annotations
3. Bootstrap flow produces usable local MVP view

This satisfies M3-01 requirement for a locally testable mobile baseline before M3-02/M3-03 feature expansion.

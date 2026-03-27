# M2-06 Stats Charts v1

## Goal

Provide first-pass visual charts for day-level metrics with explicit natural-vs-stacked semantics.

## Charts Added

### 1) Duration Semantics Chart

Location: `apps/desktop/src/App.tsx` (`DurationSemanticsChart`)

- Compares `naturalMs` and `stackedMs` with aligned bar baseline.
- Shows semantic guidance:
  - Natural duration: overlapping windows counted once.
  - Stacked duration: parallel windows accumulated.
- Exposes an "overlap multiplier" (`stacked / natural`) for quick workload signal.

### 2) Category Distribution Chart

Location: `apps/desktop/src/App.tsx` (`CategoryDistributionChart`)

- Renders top categories from day summary.
- For each category, displays two tracks on the same baseline:
  - Upper track: stacked duration
  - Lower track: natural duration
- Keeps category-level values readable in both text and bar lengths.

## Data Consistency Contract

Source of truth is `store.summarizeDay(day)` in `useActivityModel`:

- `stackedMs` and `naturalMs` cards/chart both read from the same summary object.
- Category chart reads from `summary.byPrimaryCategory`.
- Report category snapshots are now derived from the same summary categories (stacked dimension), avoiding parallel recomputation drift.

## Compatibility

- Existing event, annotation, inbox, sync, and reporting APIs are unchanged.
- No storage schema changes.
- No IPC or cross-layer contract changes.

# M2-02 Desktop Window Capture

## Goal

Capture foreground desktop window activity at runtime interval and map it into valid `ActivityEvent` records.

## What Was Added

- New `window` capture provider in `apps/desktop/src/capture/provider.ts`
- Foreground checks:
  - `document.visibilityState !== 'hidden'`
  - `hasFocus() === true` (when available)
- Resource mapping:
  - `resourceKind: 'app'`
  - `resourceKey: window://<platform>/<normalized-window-title>`
  - `resourceTitle: <document.title>`
- Event validation before returning records (invalid payloads are dropped with warning)

## Runtime Configuration

Storage keys:
- `timetracker.desktop.capture-provider`: `auto | window | browser | mock`
- `timetracker.desktop.capture-interval-ms`: capture interval in milliseconds

Defaults:
- Mode: `auto` (window first, browser second, mock fallback)
- Interval: `15000` ms (clamped to `[1000, 120000]`)

## Failure and Degradation Behavior

- Missing foreground context (hidden/not focused): provider emits `null` for that tick
- Unavailable window/browser provider in requested mode: fallback to mock provider with warning
- Invalid captured payload: dropped with warning, app keeps running

## Validation

- Unit/integration tests:
  - `apps/desktop/test/capture-provider.test.ts`
- End-to-end desktop test harness:
  - `pnpm --filter @timetracker/desktop test`

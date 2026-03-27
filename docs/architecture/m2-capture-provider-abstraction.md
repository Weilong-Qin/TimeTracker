# M2-01 Capture Provider Abstraction

## Goal

Decouple capture event generation from `useActivityModel` so providers can be swapped without refactoring store logic.

## Provider Contract

File: `apps/desktop/src/capture/provider.ts`

```ts
interface CaptureProvider {
  kind: 'window' | 'browser' | 'mock';
  isAvailable(): boolean;
  capture(deviceId: string, nowMs?: number): ActivityEvent | null;
}
```

## Modes

Supported runtime modes:
- `auto` (default): prefer window provider, then browser provider, otherwise mock
- `window`: foreground window capture
- `browser`: use browser provider, fallback to mock if unavailable
- `mock`: always use mock provider

Storage key:
- `timetracker.desktop.capture-provider`
- `timetracker.desktop.capture-interval-ms`

## Integration Point

`useActivityModel` now:
1. Resolves mode from storage.
2. Builds provider through `createCaptureProvider(...)`.
3. Calls `provider.capture(...)` in capture interval loop.

This keeps event append/annotation/sync/report flows unchanged.

## Compatibility

- Downstream event model remains `ActivityEvent`.
- Existing store pipeline is unchanged.
- Mock behavior remains available as fallback and deterministic test path.

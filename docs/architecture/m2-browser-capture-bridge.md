# M2-03 Browser Capture Bridge MVP

## Goal

Bridge browser URL/title signals into the existing `ActivityEvent` model without breaking non-browser capture paths.

## Bridge Data Contract

Storage keys:
- `timetracker.desktop.browser-bridge-enabled`
- `timetracker.desktop.browser-bridge-snapshot`

Snapshot payload (JSON):

```json
{
  "url": "https://example.com/path",
  "title": "Tab title",
  "active": true,
  "capturedAtMs": 1700000000000,
  "browser": "chrome"
}
```

## Runtime Behavior

`BrowserCaptureProvider` resolves data in this order:
1. If bridge is enabled and snapshot is valid + active, use bridge `url/title`.
2. Otherwise fallback to in-process browser target (`window.location/document.title`).
3. If neither source is available, emit no event for that tick.

All emitted payloads are validated as `ActivityEvent` before append.

## Safety and Opt-in

- Bridge is disabled by default (`browser-bridge-enabled = false`).
- Invalid or malformed snapshot payloads are ignored (safe fallback path).
- Non-browser capture paths (`window` and `mock`) remain unchanged.

## Validation

- `apps/desktop/test/capture-provider.test.ts` covers:
  - snapshot parsing
  - bridge-preferred browser capture
  - inactive bridge fallback to target browser data
  - compatibility of window/mock paths

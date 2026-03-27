# M3-05 Report History Persistence

## Goal

Persist generated and edited report artifacts across daily/weekly/monthly periods and provide reliable history retrieval.

## Persistence Model

Desktop stores report artifacts in local storage key:

- `timetracker.desktop.reports`

Payload schema:

```json
{
  "schemaVersion": 1,
  "reports": {
    "daily:2026-03-27": {
      "periodType": "daily",
      "periodKey": "2026-03-27",
      "generatedAt": 0,
      "updatedAt": 0,
      "updatedByDeviceId": "desktop-xxxx",
      "source": "ai",
      "content": "..."
    }
  }
}
```

Implemented in:

- `apps/desktop/src/lib/report-history.ts`

Key capabilities:

- report id parse/build (`daily|weekly|monthly`)
- payload parse/stringify for persistence
- upsert with stable `generatedAt` and mutable `updatedAt`
- history retrieval sorted by latest updates

## Retrieval Flow

`useActivityModel` now exposes:

- `reportHistory`: recent report entries (default top 24)
- `activeReportId`: currently loaded report entry
- `openReportHistory(reportId)`: load history item into editor

Behavior:

- day switch defaults editor to `daily:<day>`
- history click can load daily/weekly/monthly entries
- editor save writes back to currently active entry id

## Compatibility

- Existing report editor workflow remains available.
- Existing report generation/push controls remain unchanged.
- Daily generation still writes `daily:<day>` artifact.

## Validation

New executable tests:

- `apps/desktop/test/report-history.test.ts`
  - generated + edited report survives restart-like storage reload
  - daily/weekly/monthly history retrieval order is stable and reliable

Regression checks:

- `pnpm --filter @timetracker/desktop test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

# PR4 Optional AI Report and Push

## Scope Delivered

This PR4 slice adds optional report generation and optional push delivery without introducing hard dependencies in the main capture/sync flow.

- New reporting package: `@timetracker/reporting`
- Local fallback report template generation
- Optional AI report generation (`endpoint + model + apiKey`)
- Optional push adapters:
  - Generic Webhook
  - DingTalk bot webhook
  - Feishu bot webhook
- Desktop UI settings for report and push
- Manual "generate now" and "push now" actions with status feedback

## Optionality Guarantees

- AI disabled or unconfigured:
  - Report generation still succeeds via local fallback template
  - Main capture, annotation, and sync flows remain available
- AI request failure:
  - Falls back to local template and returns actionable status
  - No crash or app-level blocking
- Push unconfigured:
  - Push action returns `no push targets configured`
  - No effect on capture/sync/report editing
- Push partial failure:
  - Per-target isolation (`success` / `failed` counts returned)
  - Other enabled targets continue

## Data/Config Surface

- `timetracker.desktop.report-settings` (localStorage)
- `timetracker.desktop.push-settings` (localStorage)
- `timetracker.desktop.sync-settings` continues unchanged

## Deferred

- Scheduled daily/weekly/monthly report jobs
- Push retry queue and exponential backoff
- Rich card payloads for DingTalk/Feishu (MVP keeps plain text)

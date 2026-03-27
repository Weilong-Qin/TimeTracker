# M1-01: Storage ADR and schema

## Goal
Define persistence ADR, data schema, and migration contracts for local-first storage.

## Requirements
- Define persistent data model for events, annotations, settings, and report artifacts.
- Define versioning and migration strategy for future schema evolution.
- Document failure handling and recovery boundaries for corrupted local data.

## Acceptance Criteria
- [x] ADR and schema decisions are documented and agreed.
- [x] Target storage contracts and version fields are defined.
- [x] Migration and recovery rules are explicit and testable.

## Technical Notes
- Milestone: M1-01
- Planned date: 2026-03-27
- Scope should remain aligned with the M1/M2/M3 backlog plan.
- Output doc: `docs/architecture/m1-local-persistence-adr-schema.md`
- Key decisions captured:
  - Logical persistence domains: events / annotations / settings / reports
  - Global `meta.schemaVersion` and ordered idempotent migration contract
  - Recovery policy with fail-open behavior and quarantine on corruption

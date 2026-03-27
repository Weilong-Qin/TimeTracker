# Backend Directory Structure (Current Repository)

> This document captures how backend-like logic is currently organized in this repo.

## Canonical Structure

```text
.trellis/
  scripts/
    *.py                 # CLI entrypoints
    common/              # Shared utilities used by multiple entrypoints
    multi_agent/         # Pipeline-specific command modules
  tasks/
    <task>/
      task.json
      prd.md
  workspace/
    <developer>/
      index.md
      journal-*.md
```

## Placement Rules

1. Put command entrypoints in `.trellis/scripts/`.
2. Put reusable helper logic in `.trellis/scripts/common/`.
3. Keep data artifacts in `.trellis/tasks/` and `.trellis/workspace/`, not in `scripts/`.
4. Keep task lifecycle metadata in `task.json`; keep narrative context in `prd.md`.

## Real Examples

### 1) Thin CLI entrypoint

- File: `.trellis/scripts/get_context.py`
- Pattern: minimal wrapper importing `main` from shared implementation and executing it.

### 2) Command + helper separation

- File: `.trellis/scripts/task.py`
- Pattern: argparse and command routing in this file, with shared helpers imported from `common/*`.

### 3) Shared path contracts

- File: `.trellis/scripts/common/paths.py`
- Pattern: central constants (`DIR_WORKFLOW`, `DIR_TASKS`, etc.) and helper functions used across scripts.

### 4) Domain-focused shared module

- File: `.trellis/scripts/common/developer.py`
- Pattern: developer initialization and workspace bootstrap isolated from CLI parsing.

## Anti-Patterns To Avoid

- Defining path literals (for example, `.trellis/tasks`) in multiple scripts.
- Putting reusable logic directly into command handlers.
- Writing user/task data outside `.trellis/tasks/` or `.trellis/workspace/`.

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

run_step() {
  local name="$1"
  shift
  echo "[beta-hardening] START ${name}"
  "$@"
  echo "[beta-hardening] PASS  ${name}"
}

echo "[beta-hardening] running final regression gate"

run_step "core-test" pnpm --filter @timetracker/core test
run_step "reporting-test" pnpm --filter @timetracker/reporting test
run_step "sync-r2-test" pnpm --filter @timetracker/sync-r2 test
run_step "mobile-test" pnpm --filter @timetracker/mobile test
run_step "desktop-test" pnpm --filter @timetracker/desktop test
run_step "workspace-typecheck" pnpm typecheck
run_step "workspace-lint" pnpm lint
run_step "workspace-test" pnpm test

echo "[beta-hardening] COMPLETE no blocking failures detected"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DESKTOP_DIR}/../.." && pwd)"
CORE_DIR="${REPO_ROOT}/packages/core"

cleanup() {
  rm -rf "${DESKTOP_DIR}/.tmp-test" "${CORE_DIR}/.tmp-test-desktop"
}

trap cleanup EXIT

cleanup

pnpm exec tsc -p "${DESKTOP_DIR}/tsconfig.json" --noEmit
pnpm exec tsc -p "${CORE_DIR}/tsconfig.test.json" --outDir "${CORE_DIR}/.tmp-test-desktop"
pnpm exec tsc -p "${DESKTOP_DIR}/tsconfig.test.json"

node --import "${DESKTOP_DIR}/test/register-loader.mjs" --test "${DESKTOP_DIR}/.tmp-test/test/**/*.test.js"

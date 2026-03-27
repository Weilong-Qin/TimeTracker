#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${PKG_DIR}/../.." && pwd)"
CORE_DIR="${REPO_ROOT}/packages/core"

cleanup() {
  rm -rf "${PKG_DIR}/.tmp-test" "${CORE_DIR}/.tmp-test-sync-r2"
}

trap cleanup EXIT
cleanup

pnpm exec tsc -p "${PKG_DIR}/tsconfig.json" --noEmit
pnpm exec tsc -p "${CORE_DIR}/tsconfig.test.json" --outDir "${CORE_DIR}/.tmp-test-sync-r2"
pnpm exec tsc -p "${PKG_DIR}/tsconfig.test.json"
node --import "${PKG_DIR}/test/register-loader.mjs" --test "${PKG_DIR}/.tmp-test/test/**/*.test.js"

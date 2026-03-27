#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MOBILE_DIR}/../.." && pwd)"
CORE_DIR="${REPO_ROOT}/packages/core"

cleanup() {
  rm -rf "${MOBILE_DIR}/.tmp-test" "${CORE_DIR}/.tmp-test-mobile"
}

trap cleanup EXIT
cleanup

pnpm exec tsc -p "${MOBILE_DIR}/tsconfig.json" --noEmit
pnpm exec tsc -p "${CORE_DIR}/tsconfig.test.json" --outDir "${CORE_DIR}/.tmp-test-mobile"
pnpm exec tsc -p "${MOBILE_DIR}/tsconfig.test.json"
node --import "${MOBILE_DIR}/test/register-loader.mjs" --test "${MOBILE_DIR}/.tmp-test/test/**/*.test.js"

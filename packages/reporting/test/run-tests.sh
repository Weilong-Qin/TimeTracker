#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  rm -rf "${PKG_DIR}/.tmp-test"
}

trap cleanup EXIT
cleanup

pnpm exec tsc -p "${PKG_DIR}/tsconfig.json" --noEmit
pnpm exec tsc -p "${PKG_DIR}/tsconfig.test.json"
node --test "${PKG_DIR}/.tmp-test/test/**/*.test.js"

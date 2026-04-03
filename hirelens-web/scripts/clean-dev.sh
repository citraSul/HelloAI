#!/usr/bin/env bash
# Same as: npm run dev:clean
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/dev-clean.mjs

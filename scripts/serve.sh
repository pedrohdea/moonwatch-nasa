#!/usr/bin/env bash
# Serves the MoonWatch site (Chart.js) on http://localhost:8003/ (no browser cache).
# Ctrl+C stops all of them.
set -euo pipefail
exec node "$(dirname "$0")/serve.mjs"

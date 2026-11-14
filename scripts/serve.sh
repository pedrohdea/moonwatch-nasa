#!/usr/bin/env bash
# Serves the three MoonWatch variants: ECharts :8001, Plotly.js :8002, Chart.js :8003 (no browser cache).
# Ctrl+C stops all of them.
set -euo pipefail
exec node "$(dirname "$0")/serve.mjs"

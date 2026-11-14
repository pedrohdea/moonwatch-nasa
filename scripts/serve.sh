#!/usr/bin/env bash
# Serves the three MoonWatch variants: ECharts :8001, Plotly.js :8002, Chart.js :8003.
# Ctrl+C stops all of them.
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/../site" && pwd)"
pids=()
trap 'kill "${pids[@]}" 2>/dev/null' EXIT INT TERM

for entry in echarts:8001 plotly:8002 chartjs:8003; do
  dir="${entry%%:*}"
  port="${entry##*:}"
  python3 -m http.server "$port" --bind 127.0.0.1 --directory "$SITE_DIR/$dir" >/dev/null 2>&1 &
  pids+=("$!")
  echo "$dir -> http://localhost:$port/"
done

wait

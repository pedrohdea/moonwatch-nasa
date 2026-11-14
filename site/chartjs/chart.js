// Chart.js adapter: window.MoonChart.render(container, series).
(function (root) {
  'use strict';

  var TEXT = '#FFFFFF';
  var MUTED = '#B9C6E4';
  var GRID = 'rgba(185, 198, 228, 0.15)';
  var PICK_RADIUS = 12; // px: max distance from click to a line
  var DRAG_TOLERANCE = 5; // px: larger pointer movement counts as drag, not click

  // Plugin auto-registers; register explicitly only if the global is there but not registered.
  if (root.ChartZoom) root.Chart.register(root.ChartZoom);

  function withAlpha(color, alpha) {
    var m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function distToSegment(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  function render(container, series) {
    var canvas = root.document.createElement('canvas');
    container.appendChild(canvas);

    var chart = new root.Chart(canvas, {
      type: 'line',
      data: {
        datasets: series.map(function (s) {
          return {
            label: s.name,
            data: s.points.map(function (p) { return { x: p[0], y: p[1] }; }),
            parsing: false,
            normalized: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
            borderColor: s.color,
            backgroundColor: s.color
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        font: { family: "'Overpass', sans-serif" },
        scales: {
          x: {
            type: 'linear', min: 0, max: 10,
            grid: { color: GRID }, border: { color: MUTED },
            ticks: { color: MUTED, font: { family: "'Fira Code', monospace" } }
          },
          y: {
            type: 'linear', min: 0, max: 10,
            grid: { color: GRID }, border: { color: MUTED },
            ticks: { color: MUTED, font: { family: "'Fira Code', monospace" } }
          }
        },
        plugins: {
          legend: { labels: { color: TEXT, font: { family: "'Overpass', sans-serif" } } },
          decimation: { enabled: true, algorithm: 'lttb', samples: 600 },
          tooltip: {
            mode: 'nearest', intersect: false,
            bodyFont: { family: "'Fira Code', monospace" },
            titleFont: { family: "'Overpass', sans-serif" },
            callbacks: {
              title: function () { return ''; },
              label: function (ctx) {
                return ctx.dataset.label + ': x=' + ctx.parsed.x.toFixed(3) + ', y=' + ctx.parsed.y.toFixed(3);
              }
            }
          },
          zoom: {
            limits: { x: { min: 0, max: 10 }, y: { min: 0, max: 10 } },
            zoom: {
              mode: 'x',
              wheel: { enabled: true },
              pinch: { enabled: true },
              drag: {
                enabled: true,
                backgroundColor: 'rgba(234, 254, 7, 0.15)',
                borderColor: '#EAFE07',
                borderWidth: 1
              }
            },
            pan: { enabled: true, mode: 'xy', modifierKey: 'shift' }
          }
        }
      }
    });

    // Highlight active series, dim the rest; keeps current zoom (update 'none').
    function applyFilter(index) {
      chart.data.datasets.forEach(function (ds, i) {
        var base = series[i].color;
        var active = index === i;
        ds.borderColor = index === null || active ? base : withAlpha(base, 0.15);
        ds.borderWidth = active ? 4 : 2;
        ds.order = active ? -1 : 0; // draw highlighted line on top
      });
      chart.update('none');
    }
    applyFilter(root.MoonCore.getFilter());
    root.MoonCore.onFilterChange(applyFilter);

    // Nearest visible line within PICK_RADIUS px of the event, or null.
    function pickDataset(evt) {
      var hits = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false, axis: 'xy' }, true);
      var pos = root.Chart.helpers.getRelativePosition(evt, chart);
      var best = null, bestDist = Infinity;
      hits.forEach(function (h) {
        if (!chart.isDatasetVisible(h.datasetIndex)) return;
        var data = chart.getDatasetMeta(h.datasetIndex).data;
        var el = data[h.index];
        var d = Math.hypot(el.x - pos.x, el.y - pos.y);
        [data[h.index - 1], data[h.index + 1]].forEach(function (nb) {
          if (nb) d = Math.min(d, distToSegment(pos.x, pos.y, el, nb));
        });
        if (d < bestDist) { bestDist = d; best = h.datasetIndex; }
      });
      return bestDist <= PICK_RADIUS ? best : null;
    }

    var down = null;
    canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('click', function (e) {
      var moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_TOLERANCE;
      down = null;
      if (moved) return;
      var pos = root.Chart.helpers.getRelativePosition(e, chart);
      var a = chart.chartArea;
      if (pos.x < a.left || pos.x > a.right || pos.y < a.top || pos.y > a.bottom) return; // legend/axes
      var idx = pickDataset(e);
      root.MoonCore.setFilter(idx === null ? null : idx);
    });

    root.MoonLayout.resetZoomButton.addEventListener('click', function () { chart.resetZoom(); });
    return chart;
  }

  root.MoonChart = { render: render };
})(window);

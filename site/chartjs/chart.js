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

  // Integer ticks only (no locale thousands separator on years).
  function yearTick(v) { return Number.isInteger(v) ? String(v) : ''; }

  function distToSegment(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  var nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

  // Smaller legend on narrow canvases so 20 entries do not eat the plot.
  function legendSize(width) {
    return width < 600 ? { box: 8, font: 9 } : { box: 20, font: 12 };
  }

  function render(container, series) {
    var ds = root.MoonSeries.dataset;
    var spurious = ds.kind === 'spurious';
    var ls = legendSize(container.clientWidth || root.innerWidth);
    var canvas = root.document.createElement('canvas');
    container.appendChild(canvas);

    var chart = new root.Chart(canvas, {
      type: 'line',
      data: {
        datasets: series.map(function (s) {
          return {
            label: s.name,
            data: s.points.map(function (p) { return { x: p[0], y: p[1], raw: p[2], acc: p[3] }; }),
            unit: s.unit,
            parsing: false,
            normalized: true,
            tension: 0, // straight segments between table points
            showLine: true,
            pointRadius: function (ctx) { return 1.5 + 3.5 * (ctx.raw.acc / 100); }, // bigger = more accurate
            pointHoverRadius: function (ctx) { return 3 + 3.5 * (ctx.raw.acc / 100); },
            pointBackgroundColor: s.color,
            pointBorderColor: s.color,
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
        onResize: function (c, size) {
          var l = legendSize(size.width);
          var lab = c.options.plugins.legend.labels;
          lab.boxWidth = l.box;
          lab.font = { family: "'Overpass', sans-serif", size: l.font };
        },
        interaction: { mode: 'nearest', intersect: false },
        font: { family: "'Overpass', sans-serif" },
        scales: {
          x: {
            type: 'linear', min: ds.xRange[0], max: ds.xRange[1],
            title: { display: true, text: ds.xLabel, color: MUTED },
            grid: { color: GRID }, border: { color: MUTED },
            ticks: ds.xIsYear
              ? { color: MUTED, font: { family: "'Fira Code', monospace" }, stepSize: 1, callback: yearTick }
              : { color: MUTED, font: { family: "'Fira Code', monospace" } }
          },
          y: {
            type: 'linear', min: ds.yRange[0], max: ds.yRange[1],
            title: { display: true, text: ds.yLabel, color: MUTED },
            grid: { color: GRID }, border: { color: MUTED },
            ticks: { color: MUTED, font: { family: "'Fira Code', monospace" } }
          }
        },
        plugins: {
          legend: { labels: { color: TEXT, boxWidth: ls.box, font: { family: "'Overpass', sans-serif", size: ls.font } } },
          tooltip: {
            mode: 'nearest', intersect: false,
            bodyFont: { family: "'Fira Code', monospace" },
            titleFont: { family: "'Overpass', sans-serif" },
            callbacks: {
              title: function () { return ''; },
              label: function (ctx) {
                var acc = 'Assertividade: ' + ctx.raw.acc + '%';
                if (spurious) {
                  return [ctx.dataset.label + ' (' + ctx.parsed.x + '): ' + nf.format(ctx.raw.raw) + ' ' + ctx.dataset.unit, acc];
                }
                return [ctx.dataset.label + ': x=' + ctx.parsed.x.toFixed(3) + ', y=' + ctx.parsed.y.toFixed(3), acc];
              }
            }
          },
          zoom: {
            limits: { x: { min: ds.xRange[0], max: ds.xRange[1] }, y: { min: ds.yRange[0], max: ds.yRange[1] } },
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
        var c = index === null || active ? base : withAlpha(base, 0.15);
        ds.borderColor = c;
        ds.pointBackgroundColor = c;
        ds.pointBorderColor = c;
        ds.borderWidth = active ? 4 : 2;
        ds.order = active ? -1 : 0; // draw highlighted line on top
      });
      chart.update('none');
    }
    applyFilter(root.MoonCore.getFilter());
    root.MoonCore.onFilterChange(applyFilter);

    // Nearest visible line within PICK_RADIUS px of the event, or null.
    // Scans every segment of every visible dataset (few points, so no need for chart's nearest-element shortcut).
    function pickDataset(evt) {
      var pos = root.Chart.helpers.getRelativePosition(evt, chart);
      var best = null, bestDist = Infinity;
      chart.data.datasets.forEach(function (_, di) {
        if (!chart.isDatasetVisible(di)) return;
        var data = chart.getDatasetMeta(di).data;
        for (var k = 0; k < data.length; k++) {
          var d = k ? distToSegment(pos.x, pos.y, data[k - 1], data[k]) : Math.hypot(data[0].x - pos.x, data[0].y - pos.y);
          if (d < bestDist) { bestDist = d; best = di; }
        }
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

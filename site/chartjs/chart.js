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
    var S = root.MoonSeries;
    var viz = S.viz;
    var ls = legendSize(container.clientWidth || root.innerWidth);
    var canvas = root.document.createElement('canvas');
    container.appendChild(canvas);

    // 'cor' mode: marker fill = accuracy color, dimmed like its series when another is active.
    function colorFill(i) {
      return function (ctx) {
        var f = root.MoonCore.getFilter();
        var c = S.accuracyColor(ctx.raw.acc);
        return f === null || f === i ? c : withAlpha(c, 0.15);
      };
    }

    // Decorations drawn on the canvas (not datasets): never in legend, tooltips, hit test or indices.
    // Empty top box (below the legend) that reserves room for the vertical-line handles.
    var spacer = {
      position: 'top', weight: 999, fullSize: true, options: {}, height: 24, width: 0, left: 0, right: 0, top: 0, bottom: 0,
      isHorizontal: function () { return true; },
      update: function (w) { this.width = w; this.height = 24; },
      draw: function () {}
    };

    var decor = {
      id: 'moonDecor',
      beforeDatasetsDraw: function (c) { drawFills(c); drawDecor(c, true); },
      afterDatasetsDraw: function (c) { drawDecor(c, false); drawLine(c); drawVLines(c); },
      beforeInit: function (c) { root.Chart.layouts.addBox(c, spacer); }
    };

    var LINE_COLOR = '#EAFE07';
    var HANDLE_W = 11; // px: arrow width
    var HANDLE_H = 12; // px: arrow height

    // Pixel y of the draggable line, or null when outside the visible y range (zoom).
    function linePixel(c) {
      var py = c.scales.y.getPixelForValue(root.MoonCore.line.get());
      return py >= c.chartArea.top - 0.5 && py <= c.chartArea.bottom + 0.5 ? py : null;
    }

    // Dashed horizontal line + left-pointing arrow just right of the plot + pt-BR value label.
    function drawLine(c) {
      var py = linePixel(c);
      if (py === null) return;
      var ctx = c.ctx, a = c.chartArea;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.left, py);
      ctx.lineTo(a.right, py);
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = LINE_COLOR;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.right + 1, py);
      ctx.lineTo(a.right + 1 + HANDLE_W, py - HANDLE_H / 2);
      ctx.lineTo(a.right + 1 + HANDLE_W, py + HANDLE_H / 2);
      ctx.closePath();
      ctx.fillStyle = LINE_COLOR;
      ctx.fill();
      ctx.font = "11px 'Fira Code', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(root.MoonCore.line.get().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), a.right + HANDLE_W + 3, py);
      ctx.restore();
    }

    var VH_W = 12; // px: down-arrow width
    var VH_H = 10; // px: down-arrow height
    var VH_OFFSET = 8; // px: handle center above the plot top

    // Pixel x of a vertical line, or null when outside the visible x range (zoom).
    function vlinePixel(c, v) {
      var px = c.scales.x.getPixelForValue(v);
      return px >= c.chartArea.left - 0.5 && px <= c.chartArea.right + 0.5 ? px : null;
    }

    // Dashed vertical lines + down-pointing handle above the plot + V1..Vn label.
    function drawVLines(c) {
      var ctx = c.ctx, a = c.chartArea, cy = a.top - VH_OFFSET;
      root.MoonCore.vlines.list().forEach(function (l, i) {
        if (!root.MoonCore.vlineVisible(i)) return; // series hidden in the legend
        var px = vlinePixel(c, l.value);
        if (px === null) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px, a.top);
        ctx.lineTo(px, a.bottom);
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = withAlpha(root.MoonCore.vlineColor(i), 0.85); // color of series i
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(px - VH_W / 2, cy - VH_H / 2);
        ctx.lineTo(px + VH_W / 2, cy - VH_H / 2);
        ctx.lineTo(px, cy + VH_H / 2);
        ctx.closePath();
        ctx.fillStyle = root.MoonCore.vlineColor(i);
        ctx.fill();
        ctx.font = "11px 'Fira Code', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('V' + (i + 1), px + VH_W / 2 + 3, cy);
        ctx.restore();
      });
    }

    // Translucent fill between curve and horizontal line (polygons in data units from MoonCore.fills), under the lines.
    function drawFills(c) {
      var ctx = c.ctx, xs = c.scales.x, ys = c.scales.y, a = c.chartArea, f = root.MoonCore.getFilter();
      ctx.save();
      ctx.beginPath();
      ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top);
      ctx.clip();
      root.MoonCore.fills().forEach(function (fl) {
        if (!c.isDatasetVisible(fl.seriesIndex)) return;
        ctx.fillStyle = withAlpha(fl.color, f === fl.seriesIndex ? 0.35 : 0.22);
        fl.polygons.forEach(function (poly) {
          ctx.beginPath();
          poly.forEach(function (p, k) { ctx[k ? 'lineTo' : 'moveTo'](xs.getPixelForValue(p[0]), ys.getPixelForValue(p[1])); });
          ctx.closePath();
          ctx.fill();
        });
      });
      ctx.restore();
    }

    function drawDecor(c, below) {
      if (viz === 'tamanho' || viz === 'cor') return;
      var ctx = c.ctx, xs = c.scales.x, ys = c.scales.y, a = c.chartArea;
      ctx.save();
      ctx.beginPath();
      ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top);
      ctx.clip();
      S.focus(root.MoonCore.getFilter()).forEach(function (i) {
        if (!c.isDatasetVisible(i)) return;
        var sr = series[i], color = sr.color, tol = ds.tolerance;
        var ref = sr.reference.map(function (r) { return { x: xs.getPixelForValue(r[0]), y: ys.getPixelForValue(r[1]) }; });
        if (below && viz === 'faixa') {
          ctx.beginPath();
          sr.reference.forEach(function (r, k) { ctx[k ? 'lineTo' : 'moveTo'](xs.getPixelForValue(r[0]), ys.getPixelForValue(r[1] + tol)); });
          for (var k = sr.reference.length - 1; k >= 0; k--) ctx.lineTo(xs.getPixelForValue(sr.reference[k][0]), ys.getPixelForValue(sr.reference[k][1] - tol));
          ctx.closePath();
          ctx.fillStyle = withAlpha(color, 0.15);
          ctx.fill();
        }
        if (below && (viz === 'desvio' || viz === 'faixa')) {
          ctx.beginPath();
          ref.forEach(function (p, k) { ctx[k ? 'lineTo' : 'moveTo'](p.x, p.y); });
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = withAlpha(color, 0.8);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (below) return;
        var pts = c.getDatasetMeta(i).data;
        sr.points.forEach(function (p, k) {
          var el = pts[k];
          if (viz === 'desvio') {
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.lineTo(el.x, ys.getPixelForValue(p[4]));
            ctx.lineWidth = 2;
            ctx.strokeStyle = S.accuracyColor(p[3]);
            ctx.stroke();
          } else if (viz === 'rotulo') {
            ctx.font = "11px 'Fira Code', monospace";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.font = "bold 11px 'Fira Code', monospace";
            ctx.fillStyle = S.accuracyColor(p[3]); // label color = accuracy
            ctx.fillText(p[3] + '%', el.x, el.y - 7);
          }
        });
      });
      ctx.restore();
    }

    var chart = new root.Chart(canvas, {
      type: 'line',
      data: {
        datasets: series.map(function (s, i) {
          return {
            label: s.name,
            data: s.points.map(function (p) { return { x: p[0], y: p[1], raw: p[2], acc: p[3], refY: p[4] }; }),
            unit: s.unit,
            parsing: false,
            normalized: true,
            tension: 0, // straight segments between table points
            showLine: true,
            pointRadius: function (ctx) { return viz === 'tamanho' ? MoonSeries.markerSize(ctx.raw.acc) / 2 : viz === 'cor' ? 3.5 : 3; }, // tamanho: bigger = more accurate
            pointHoverRadius: function (ctx) { return viz === 'tamanho' ? MoonSeries.markerSize(ctx.raw.acc) / 2 + 1.5 : 6; },
            pointBackgroundColor: viz === 'cor' ? colorFill(i) : s.color,
            pointBorderColor: s.color,
            borderWidth: 2,
            borderColor: s.color,
            backgroundColor: s.color
          };
        })
      },
      plugins: [decor],
      options: {
        layout: { padding: { right: 46, top: 4 } },
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
          legend: {
            // Default toggle, then report every dataset's visibility to MoonCore.
            onClick: function (e, item, legend) {
              root.Chart.defaults.plugins.legend.onClick.call(this, e, item, legend);
              chart.data.datasets.forEach(function (_, i) { root.MoonCore.setVisible(i, chart.isDatasetVisible(i)); });
            },
            // Stable legend order: datasets' `order` changes when a series is highlighted, legend must not jump.
            labels: { color: TEXT, boxWidth: ls.box, font: { family: "'Overpass', sans-serif", size: ls.font }, sort: function (a, b) { return a.datasetIndex - b.datasetIndex; } }
          },
          tooltip: {
            mode: 'nearest', intersect: false,
            bodyFont: { family: "'Fira Code', monospace" },
            titleFont: { family: "'Overpass', sans-serif" },
            callbacks: {
              title: function () { return ''; },
              label: function (ctx) {
                var acc = 'Assertividade: ' + ctx.raw.acc + '%';
                var dev = ctx.raw.y - ctx.raw.refY;
                var extra = [acc, 'Referência (' + ds.referenceLabel + '): ' + nf.format(ctx.raw.refY),
                  'Desvio: ' + (dev > 0 ? '+' : '') + nf.format(dev)];
                if (spurious) {
                  return [ctx.dataset.label + ' (' + ctx.parsed.x + '): ' + nf.format(ctx.raw.raw) + ' ' + ctx.dataset.unit].concat(extra);
                }
                return [ctx.dataset.label + ': x=' + ctx.parsed.x.toFixed(3) + ', y=' + ctx.parsed.y.toFixed(3)].concat(extra);
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
        if (viz !== 'cor') ds.pointBackgroundColor = c;
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

    // Line drag (horizontal line or vertical lines): capture-phase listeners keep plugin-zoom (drag-zoom/pan) and the filter click out of it.
    var lineDrag = false, vDrag = null, swallowClick = false;
    function onHandle(e) {
      var py = linePixel(chart);
      if (py === null) return false;
      var pos = root.Chart.helpers.getRelativePosition(e, chart), a = chart.chartArea;
      var onArrow = Math.abs(pos.x - (a.right + 1 + HANDLE_W / 2)) <= 8 + HANDLE_W / 2 && pos.x >= a.right && Math.abs(pos.y - py) <= 8;
      var onLine = pos.x >= a.left && pos.x <= a.right && Math.abs(pos.y - py) <= 5;
      return onArrow || onLine;
    }
    // Id of the vertical line whose handle (<= 9 px) or body (<= 5 px, inside the plot) is under the pointer, or null.
    function vHit(e) {
      var pos = root.Chart.helpers.getRelativePosition(e, chart), a = chart.chartArea, hit = null, best = Infinity;
      root.MoonCore.vlines.list().forEach(function (l, k) {
        if (!root.MoonCore.vlineVisible(k)) return; // hidden lines are not hit-testable
        var px = vlinePixel(chart, l.value);
        if (px === null) return;
        var d = Math.abs(pos.x - px);
        var onHandleV = Math.hypot(pos.x - px, pos.y - (a.top - VH_OFFSET)) <= 9;
        var onBody = pos.y >= a.top && pos.y <= a.bottom && d <= 5;
        if ((onHandleV || onBody) && d < best) { best = d; hit = l.id; }
      });
      return hit;
    }
    function setFromPointer(e) {
      var pos = root.Chart.helpers.getRelativePosition(e, chart);
      if (vDrag !== null) root.MoonCore.vlines.set(vDrag, chart.scales.x.getValueForPixel(pos.x), 'drag');
      else root.MoonCore.line.set(chart.scales.y.getValueForPixel(pos.y), 'drag');
    }
    canvas.addEventListener('pointerdown', function (e) {
      var v = onHandle(e) ? null : vHit(e); // horizontal handle has priority
      if (v === null && !onHandle(e)) return;
      lineDrag = true;
      vDrag = v;
      canvas.setPointerCapture(e.pointerId);
      e.stopImmediatePropagation();
      e.preventDefault();
      setFromPointer(e);
    }, true);
    canvas.addEventListener('mousedown', function (e) {
      if (lineDrag || onHandle(e) || vHit(e) !== null) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
    canvas.addEventListener('pointermove', function (e) {
      if (lineDrag) { setFromPointer(e); return; }
      canvas.style.cursor = onHandle(e) ? 'ns-resize' : vHit(e) !== null ? 'ew-resize' : '';
    });
    function endDrag() {
      if (!lineDrag) return;
      lineDrag = false;
      vDrag = null;
      swallowClick = true;
      root.setTimeout(function () { swallowClick = false; }, 0); // click, if any, fires right after pointerup
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    root.MoonCore.line.onChange(function () { chart.draw(); });
    root.MoonCore.vlines.onChange(function () { chart.draw(); });
    root.MoonCore.onVisibilityChange(function () { chart.draw(); });

    var down = null;
    canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('click', function (e) {
      if (swallowClick) { swallowClick = false; return; }
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

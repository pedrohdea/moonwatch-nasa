// Plotly.js adapter: draws the series, wires zoom reset and the shared filter.
(function (root) {
  'use strict';

  var TEXT = '#FFFFFF';
  var MUTED = '#B9C6E4';
  var GRID = 'rgba(185, 198, 228, 0.18)';
  var MOVE_TOLERANCE = 5; // px: larger mouse movement is a drag (zoom/pan), not a click
  var CLICK_WINDOW = 300; // ms: a plotly_click this close to a DOM click means a line was hit
  var HIT_RADIUS = 12; // px: same tolerance as hoverdistance and the Chart.js variant
  var LINE_COLOR = '#EAFE07';

  function axis(title, range, isYear) {
    return assign({
      title: { text: title, font: { family: 'Fira Code, monospace', size: 13, color: MUTED } },
      range: range.slice(),
      autorange: false,
      gridcolor: GRID,
      zerolinecolor: GRID,
      linecolor: GRID,
      tickfont: { family: 'Fira Code, monospace', size: 12, color: MUTED },
      hoverformat: '.3f',
      fixedrange: false
    }, isYear ? { tickformat: 'd', hoverformat: 'd', separatethousands: false } : {});
  }

  function assign(a, b) {
    Object.keys(b).forEach(function (k) { a[k] = b[k]; });
    return a;
  }

  function render(container, series) {
    var Plotly = root.Plotly;
    var core = root.MoonCore;
    var lastPlotClick = 0;
    var ds = root.MoonSeries.dataset;
    var spurious = ds.kind === 'spurious';
    var narrow = container.clientWidth < 560;

    var S = root.MoonSeries;
    var viz = S.viz;
    var mainCount = series.length;
    var markerSize = { tamanho: null, cor: 7 }[viz] || 6;

    var traces = series.map(function (s) {
      var t = {
        type: 'scatter',
        mode: 'lines+markers',
        name: s.name,
        x: s.points.map(function (p) { return p[0]; }),
        y: s.points.map(function (p) { return p[1]; }),
        // Straight segments between the table points.
        line: { color: s.color, width: 2, shape: 'linear' },
        marker: {
          color: s.color,
          size: s.points.map(function (p) { return markerSize || MoonSeries.markerSize(p[3]); })
        },
        // [raw value, accuracy, reference, deviation]
        customdata: s.points.map(function (p) { return [p[2], p[3], p[4], p[1] - p[4]]; }),
        opacity: 1
      };
      if (viz === 'cor') {
        t.marker.color = s.points.map(function (p) { return S.accuracyColor(p[3]); });
        t.marker.line = { color: s.color, width: 1.5 };
      }
      var extra = '<br>Referência: %{customdata[2]:.3f}<br>Desvio: %{customdata[3]:+.3f}';
      if (spurious) {
        t.hovertemplate = '<b>%{fullData.name}</b><br>Ano: %{x:d}<br>Valor: %{customdata[0]:,} ' + s.unit + '<br>Assertividade: %{customdata[1]}%' + extra + '<extra></extra>';
      } else {
        t.hovertemplate = '<b>%{fullData.name}</b><br>x: %{x:.3f}<br>y: %{y:.3f}<br>Assertividade: %{customdata[1]}%' + extra + '<extra></extra>';
      }
      return t;
    });

    // Decorations for the focused series: extra traces (reference, band, labels) and layout shapes (deviation).
    function decorations(focusIdx) {
      var extraTraces = [];
      var shapes = [];
      var tol = ds.tolerance;
      focusIdx.forEach(function (i) {
        var s = series[i];
        var ref = s.reference;
        if (viz === 'faixa') {
          var xs = ref.map(function (r) { return r[0]; });
          extraTraces.push({
            type: 'scatter', mode: 'lines', x: xs.concat(xs.slice().reverse()),
            y: ref.map(function (r) { return r[1] + tol; }).concat(ref.slice().reverse().map(function (r) { return r[1] - tol; })),
            fill: 'toself', fillcolor: hexToRgba(s.color, 0.15), line: { width: 0 },
            hoverinfo: 'skip', showlegend: false
          });
        }
        if (viz === 'desvio' || viz === 'faixa') {
          extraTraces.push({
            type: 'scatter', mode: 'lines', x: ref.map(function (r) { return r[0]; }), y: ref.map(function (r) { return r[1]; }),
            line: { color: s.color, width: 1.5, dash: 'dash' }, opacity: 0.8,
            hoverinfo: 'skip', showlegend: false
          });
        }
        if (viz === 'desvio') {
          s.points.forEach(function (p) {
            shapes.push({
              type: 'line', xref: 'x', yref: 'y', x0: p[0], x1: p[0], y0: p[1], y1: p[4],
              line: { color: S.accuracyColor(p[3]), width: 2 }, layer: 'above'
            });
          });
        }
        if (viz === 'rotulo') {
          extraTraces.push({
            type: 'scatter', mode: 'text',
            x: s.points.map(function (p) { return p[0]; }), y: s.points.map(function (p) { return p[1]; }),
            text: s.points.map(function (p) { return p[3] + '%'; }),
            textposition: 'top center', textfont: { family: 'Fira Code, monospace', size: 11, color: s.points.map(function (p) { return MoonSeries.accuracyColor(p[3]); }) }, // label color = accuracy
            hoverinfo: 'skip', showlegend: false
          });
        }
      });
      return { traces: extraTraces, shapes: shapes };
    }

    function hexToRgba(hex, alpha) {
      var n = parseInt(hex.replace('#', ''), 16);
      return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }

    var layout = {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Overpass, sans-serif', size: 13, color: TEXT },
      margin: { l: 56, r: 56, t: 44, b: 56 }, // right margin holds the hline handle; top margin holds the vline handles below the modebar
      xaxis: axis(ds.xLabel, ds.xRange, ds.xIsYear),
      yaxis: axis(ds.yLabel, ds.yRange, false),
      separators: ',.',
      shapes: [],
      hovermode: 'closest',
      hoverdistance: 12, // px; same click tolerance as the Chart.js variant, keeps empty clicks possible with 20 curves on phones
      clickmode: 'event',
      dragmode: 'zoom',
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.2,
        yanchor: 'top',
        font: { family: 'Overpass, sans-serif', size: narrow ? 10 : 12, color: TEXT }
      },
      hoverlabel: { font: { family: 'Fira Code, monospace', size: 12 }, bordercolor: MUTED }
    };

    var config = {
      responsive: true,
      scrollZoom: true,
      displaylogo: false,
      displayModeBar: true,
      modeBarButtonsToRemove: ['select2d', 'lasso2d', 'toggleSpikelines', 'hoverClosestCartesian', 'hoverCompareCartesian'],
      toImageButtonOptions: { format: 'png', filename: 'moonwatch' },
      locale: 'pt-BR'
    };

    var decoCount = 0;
    var devShapes = [];

    // Horizontal draggable line, always the last shape so deviation shapes can be rebuilt independently.
    function hlineShape() {
      return {
        name: 'hline', type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: core.line.get(), y1: core.line.get(),
        line: { color: LINE_COLOR, width: 2, dash: 'dash' }, layer: 'above'
      };
    }
    // Vertical draggable lines: one shape per line, spanning the full plot height.
    function vlineShapes() {
      return core.vlines.list().map(function (l, i) {
        return {
          name: 'vline-' + l.id, type: 'line', xref: 'x', x0: l.value, x1: l.value, yref: 'paper', y0: 0, y1: 1,
          line: { color: core.vlineColor(i), width: 1.5, dash: 'dash' }, opacity: 0.85, layer: 'above'
        };
      }).filter(function (sh, i) { return core.vlineVisible(i); }); // series hidden in the legend: no line
    }
    // Fill polygons (data units) below the traces; shapes are not hoverable or clickable and follow zoom.
    function fillShapes() {
      var active = core.getFilter();
      var out = [];
      core.fills().forEach(function (f) {
        var alpha = Number.isInteger(active) && f.seriesIndex === active ? 0.35 : 0.22;
        f.polygons.forEach(function (poly) {
          if (poly.length < 3) return;
          out.push({
            type: 'path', xref: 'x', yref: 'y',
            path: 'M ' + poly.map(function (p) { return p[0] + ',' + p[1]; }).join(' L ') + ' Z',
            fillcolor: hexToRgba(f.color, alpha), line: { width: 0 }, layer: 'below'
          });
        });
      });
      return out;
    }
    function allShapes() { return fillShapes().concat(devShapes, [hlineShape()], vlineShapes()); }
    layout.shapes = allShapes();

    var queue = Promise.resolve();
    var mainIdx = series.map(function (_, i) { return i; });

    function applyFilter(index) {
      var active = Number.isInteger(index);
      Plotly.restyle(container, {
        'line.width': series.map(function (_, i) { return active && i === index ? 4 : 2; }),
        opacity: series.map(function (_, i) { return !active || i === index ? 1 : 0.15; })
      }, mainIdx);
      if (viz === 'tamanho' || viz === 'cor') return Plotly.relayout(container, { shapes: allShapes() });
      var d = decorations(S.focus(active ? index : null));
      // Serialized so quick filter changes cannot interleave trace deletion and insertion.
      queue = queue.then(function () {
        var drop = [];
        for (var k = 0; k < decoCount; k++) drop.push(mainCount + k);
        decoCount = d.traces.length;
        return drop.length ? Plotly.deleteTraces(container, drop) : null;
      }).then(function () {
        return decoCount ? Plotly.addTraces(container, d.traces) : null;
      }).then(function () {
        devShapes = d.shapes;
        return Plotly.relayout(container, { shapes: allShapes() });
      });
      return queue;
    }

    return Plotly.newPlot(container, traces, layout, config).then(function () {
      // Handle: HTML triangle + value label over the right edge of the plot area.
      if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
      var handle = document.createElement('div');
      handle.className = 'hline-handle';
      handle.style.cssText = 'position:absolute;display:none;align-items:center;height:20px;cursor:ns-resize;touch-action:none;user-select:none;z-index:5;';
      handle.innerHTML = '<span style="width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-right:11px solid ' + LINE_COLOR + ';"></span>' +
        '<span class="hline-label" style="margin-left:3px;font:11px Fira Code,monospace;color:' + LINE_COLOR + ';"></span>';
      container.appendChild(handle);
      var label = handle.querySelector('.hline-label');

      function placeHandle() {
        var L = container._fullLayout;
        if (!L || !L._size) return;
        var v = core.line.get();
        var r = L.yaxis.range;
        label.textContent = v.toFixed(2).replace('.', ',');
        // Out of the visible y range: hide the handle (the shape is clipped by the plot area).
        if (v < Math.min(r[0], r[1]) || v > Math.max(r[0], r[1])) { handle.style.display = 'none'; return; }
        handle.style.display = 'flex';
        handle.style.left = (L._size.l + L._size.w) + 'px';
        handle.style.top = (L._size.t + L.yaxis.l2p(v) - 10) + 'px';
      }
      function drawLine() {
        placeHandle();
        Plotly.relayout(container, { shapes: allShapes() });
      }
      core.line.onChange(function (v, source) {
        if (source === 'drag') { placeHandle(); Plotly.relayout(container, { shapes: allShapes() }); } else drawLine();
      });
      container.on('plotly_afterplot', placeHandle);
      placeHandle();

      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        function move(ev) {
          var L = container._fullLayout;
          var py = ev.clientY - container.getBoundingClientRect().top - L._size.t;
          core.line.set(L.yaxis.p2l(py), 'drag');
        }
        function up(ev) {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
          if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId);
        }
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
      });
      ['mousedown', 'click'].forEach(function (t) {
        handle.addEventListener(t, function (e) { e.stopPropagation(); });
      });

      // Vertical line handles: HTML down-pointing triangle + label above the plot, one per line.
      var vHandles = {}; // id -> element
      function syncVHandles() {
        var L = container._fullLayout;
        if (!L || !L._size) return;
        var lines = core.vlines.list();
        var live = {};
        lines.forEach(function (l, i) {
          if (!core.vlineVisible(i)) return; // hidden series: handle removed below so it cannot catch events
          live[l.id] = true;
          var el = vHandles[l.id] || createVHandle(l.id);
          var r = L.xaxis.range;
          el.querySelector('.vline-label').textContent = 'V' + (i + 1);
          el.querySelector('.vline-label').style.color = core.vlineColor(i); // color of series i
          el.firstChild.style.borderTopColor = core.vlineColor(i);
          if (l.value < Math.min(r[0], r[1]) || l.value > Math.max(r[0], r[1])) { el.style.display = 'none'; return; }
          el.style.display = 'block';
          el.style.left = (L._size.l + L.xaxis.l2p(l.value) - 10) + 'px';
          el.style.top = (L._size.t - 8 - 10) + 'px'; // 20 px box: center exactly 8 px above the plot top
        });
        Object.keys(vHandles).forEach(function (id) {
          if (!live[id]) { vHandles[id].remove(); delete vHandles[id]; }
        });
      }
      function createVHandle(id) {
        var el = document.createElement('div');
        el.className = 'vline-handle';
        el.style.cssText = 'position:absolute;display:none;width:20px;height:20px;cursor:ew-resize;touch-action:none;user-select:none;z-index:5;';
        el.innerHTML = '<span style="position:absolute;left:4px;top:5px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #FFFFFF;"></span>' +
          '<span class="vline-label" style="position:absolute;left:22px;top:3px;font:11px Fira Code,monospace;color:#FFFFFF;white-space:nowrap;"></span>';
        container.appendChild(el);
        vHandles[id] = el;
        el.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          e.stopPropagation();
          el.setPointerCapture(e.pointerId);
          function move(ev) {
            var L = container._fullLayout;
            var px = ev.clientX - container.getBoundingClientRect().left - L._size.l;
            core.vlines.set(id, L.xaxis.p2l(px), 'drag');
          }
          function up(ev) {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
          }
          el.addEventListener('pointermove', move);
          el.addEventListener('pointerup', up);
          el.addEventListener('pointercancel', up);
        });
        ['mousedown', 'click'].forEach(function (t) {
          el.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        return el;
      }
      core.vlines.onChange(function () {
        syncVHandles();
        Plotly.relayout(container, { shapes: allShapes() });
      });
      container.on('plotly_afterplot', syncVHandles);
      syncVHandles();

      // Legend toggles (click, double-click, Plotly.restyle) change trace.visible: report it to the core.
      container.on('plotly_restyle', function () {
        container._fullData.slice(0, mainCount).forEach(function (t, k) { core.setVisible(k, t.visible === true); });
      });
      core.onVisibilityChange(function () {
        syncVHandles();
        Plotly.relayout(container, { shapes: allShapes() });
      });

      applyFilter(core.getFilter());
      core.onFilterChange(applyFilter);

      // Click on a line: Plotly only emits this when the cursor is within hoverdistance of a trace.
      container.on('plotly_click', function (ev) {
        lastPlotClick = Date.now();
        var point = ev && ev.points && ev.points[0];
        if (point && point.curveNumber < mainCount) core.setFilter(point.curveNumber);
      });

      // Empty click: clear filter when no plotly_click fired and the mouse did not drag.
      var down = null;
      container.addEventListener('mousedown', function (e) {
        if (e.target.closest && e.target.closest('.hline-handle, .vline-handle')) return;
        down = { x: e.clientX, y: e.clientY };
      }, true);
      container.addEventListener('click', function (e) {
        var target = e.target;
        if (target.closest && target.closest('.hline-handle, .vline-handle')) return;
        var moved = !down || Math.abs(e.clientX - down.x) > MOVE_TOLERANCE || Math.abs(e.clientY - down.y) > MOVE_TOLERANCE;
        down = null;
        if (moved || !target.closest || !target.closest('.nsewdrag, .draglayer')) return; // legend, modebar and axes are ignored
        // plotly_click may fire before or after this DOM click, so compare timestamps.
        var cx = e.clientX;
        var cy = e.clientY;
        setTimeout(function () {
          if (Date.now() - lastPlotClick <= CLICK_WINDOW) return;
          // Plotly hover only measures distance to points; between points we test the segments ourselves.
          var hit = segmentHit(cx, cy);
          core.setFilter(hit);
        }, 0);
      });

      // Nearest visible main series whose line segment is within hoverdistance (px), else null.
      function segmentHit(clientX, clientY) {
        var L = container._fullLayout;
        var box = container.getBoundingClientRect();
        var px = clientX - box.left - L._size.l;
        var py = clientY - box.top - L._size.t;
        var best = null;
        var bestDist = HIT_RADIUS;
        container._fullData.slice(0, mainCount).forEach(function (trace, i) {
          if (trace.visible !== true) return; // hidden via legend
          var pts = series[i].points;
          for (var k = 1; k < pts.length; k++) {
            var d = distToSegment(px, py,
              L.xaxis.l2p(pts[k - 1][0]), L.yaxis.l2p(pts[k - 1][1]),
              L.xaxis.l2p(pts[k][0]), L.yaxis.l2p(pts[k][1]));
            if (d <= bestDist) { bestDist = d; best = i; }
          }
        });
        return best;
      }

      function distToSegment(px, py, ax, ay, bx, by) {
        var dx = bx - ax;
        var dy = by - ay;
        var len = dx * dx + dy * dy;
        var t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }

      var reset = root.MoonLayout && root.MoonLayout.resetZoomButton;
      if (reset) {
        reset.addEventListener('click', function () {
          Plotly.relayout(container, {
            'xaxis.range': ds.xRange.slice(), 'xaxis.autorange': false,
            'yaxis.range': ds.yRange.slice(), 'yaxis.autorange': false
          });
        });
      }
    });
  }

  root.MoonChart = { render: render };
})(window);

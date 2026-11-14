// Plotly.js adapter: draws the series, wires zoom reset and the shared filter.
(function (root) {
  'use strict';

  var TEXT = '#FFFFFF';
  var MUTED = '#B9C6E4';
  var GRID = 'rgba(185, 198, 228, 0.18)';
  var MOVE_TOLERANCE = 5; // px: larger mouse movement is a drag (zoom/pan), not a click
  var CLICK_WINDOW = 300; // ms: a plotly_click this close to a DOM click means a line was hit
  var HIT_RADIUS = 12; // px: same tolerance as hoverdistance and the Chart.js variant

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
      margin: { l: 56, r: 20, t: 16, b: 56 },
      xaxis: axis(ds.xLabel, ds.xRange, ds.xIsYear),
      yaxis: axis(ds.yLabel, ds.yRange, false),
      separators: ',.',
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
    var queue = Promise.resolve();
    var mainIdx = series.map(function (_, i) { return i; });

    function applyFilter(index) {
      var active = Number.isInteger(index);
      Plotly.restyle(container, {
        'line.width': series.map(function (_, i) { return active && i === index ? 4 : 2; }),
        opacity: series.map(function (_, i) { return !active || i === index ? 1 : 0.15; })
      }, mainIdx);
      if (viz === 'tamanho' || viz === 'cor') return;
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
        return Plotly.relayout(container, { shapes: d.shapes });
      });
      return queue;
    }

    return Plotly.newPlot(container, traces, layout, config).then(function () {
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
        down = { x: e.clientX, y: e.clientY };
      }, true);
      container.addEventListener('click', function (e) {
        var target = e.target;
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

// Plotly.js adapter: draws the series, wires zoom reset and the shared filter.
(function (root) {
  'use strict';

  var TEXT = '#FFFFFF';
  var MUTED = '#B9C6E4';
  var GRID = 'rgba(185, 198, 228, 0.18)';
  var MOVE_TOLERANCE = 5; // px: larger mouse movement is a drag (zoom/pan), not a click
  var CLICK_WINDOW = 300; // ms: a plotly_click this close to a DOM click means a line was hit

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

    var traces = series.map(function (s) {
      var t = {
        type: 'scatter',
        mode: 'lines+markers',
        name: s.name,
        x: s.points.map(function (p) { return p[0]; }),
        y: s.points.map(function (p) { return p[1]; }),
        // Straight segments between the table points; marker size grows with accuracy (3..10 px).
        line: { color: s.color, width: 2, shape: 'linear' },
        marker: { color: s.color, size: s.points.map(function (p) { return 3 + 7 * p[3] / 100; }) },
        customdata: s.points.map(function (p) { return [p[2], p[3]]; }),
        opacity: 1
      };
      if (spurious) {
        t.hovertemplate = '<b>%{fullData.name}</b><br>Ano: %{x:d}<br>Valor: %{customdata[0]:,} ' + s.unit + '<br>Assertividade: %{customdata[1]}%<extra></extra>';
      } else {
        t.hovertemplate = '<b>%{fullData.name}</b><br>x: %{x:.3f}<br>y: %{y:.3f}<br>Assertividade: %{customdata[1]}%<extra></extra>';
      }
      return t;
    });

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

    function applyFilter(index) {
      var active = Number.isInteger(index);
      Plotly.restyle(container, {
        'line.width': series.map(function (_, i) { return active && i === index ? 4 : 2; }),
        opacity: series.map(function (_, i) { return !active || i === index ? 1 : 0.15; })
      });
    }

    return Plotly.newPlot(container, traces, layout, config).then(function () {
      applyFilter(core.getFilter());
      core.onFilterChange(applyFilter);

      // Click on a line: Plotly only emits this when the cursor is within hoverdistance of a trace.
      container.on('plotly_click', function (ev) {
        lastPlotClick = Date.now();
        var point = ev && ev.points && ev.points[0];
        if (point) core.setFilter(point.curveNumber);
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
        setTimeout(function () {
          if (Date.now() - lastPlotClick > CLICK_WINDOW) core.setFilter(null);
        }, 0);
      });

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

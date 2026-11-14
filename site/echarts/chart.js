// ECharts adapter: renders the 6 series and syncs the shared filter (MoonCore).
(function (root) {
  'use strict';

  var TEXT = '#FFFFFF';
  var MUTED = '#B9C6E4';
  var GRID = 'rgba(185, 198, 228, 0.18)';
  var BG = '#07173F';
  var ACCENT = '#EAFE07';

  function render(container, series) {
    var chart = root.echarts.init(container, null, { renderer: 'canvas' });
    var core = root.MoonCore;

    var MS = root.MoonSeries;
    var viz = MS.viz;
    var tol = MS.dataset.tolerance;
    var hex = function (c, a) { // '#RRGGBB' -> rgba string
      return 'rgba(' + [1, 3, 5].map(function (k) { return parseInt(c.substr(k, 2), 16); }).join(',') + ',' + a + ')';
    };

    function seriesStyle(active, i) {
      var dim = active !== null && active !== i;
      var op = dim ? 0.15 : 1;
      var itemStyle = { color: series[i].color, opacity: op };
      if (viz === 'cor') {
        itemStyle = {
          color: function (p) { return MS.accuracyColor(p.value[3]); },
          borderColor: series[i].color, borderWidth: 2, opacity: op
        };
      }
      return {
        lineStyle: { width: active === i ? 4 : 2, opacity: op },
        itemStyle: itemStyle,
        z: active === i ? 10 : 2
      };
    }

    var LABEL_RICH = {};
    for (var b = 0; b <= 10; b++) LABEL_RICH['a' + b] = { color: MoonSeries.accuracyColor(b * 10), fontFamily: 'Fira Code, monospace', fontSize: 11, fontWeight: 'bold' };

    function symbolSize(value) {
      if (viz === 'tamanho') return MoonSeries.markerSize(value[3]);
      return viz === 'cor' ? 7 : 6;
    }

    // Main series (ids s0..sn-1, always first so seriesIndex == series index).
    function mainSeries(active, focus, withData) {
      return series.map(function (s, i) {
        var st = seriesStyle(active, i);
        var o = {
          id: 's' + i, name: s.name, type: 'line',
          lineStyle: st.lineStyle, itemStyle: st.itemStyle, z: st.z,
          label: {
            show: viz === 'rotulo' && focus.indexOf(i) >= 0, position: 'top', distance: 6,
            fontFamily: 'Fira Code, monospace', fontSize: 11, fontWeight: 'bold',
            // Label color = accuracy, via one rich style per 10% bucket.
            formatter: function (p) { return '{a' + Math.round(p.value[3] / 10) + '|' + p.value[3] + '%}'; },
            rich: LABEL_RICH
          }
        };
        if (withData) {
          o.data = s.points; o.dimensions = ['x', 'y', 'raw', 'acc', 'ref'];
          o.encode = { x: 'x', y: 'y' }; o.showSymbol = true; o.symbolSize = symbolSize;
          o.triggerLineEvent = true; o.smooth = false; o.emphasis = { disabled: true };
        }
        return o;
      });
    }

    // Decoration series: silent, no tooltip, appended after the main ones, ids d*.
    function decorations(focus) {
      var out = [];
      var base = { silent: true, tooltip: { show: false }, legendHoverLink: false, z: 1 };
      if (viz === 'desvio' || viz === 'faixa') {
        focus.forEach(function (i) {
          var s = series[i];
          if (viz === 'faixa') {
            out.push(Object.assign({}, base, {
              id: 'dband' + i, type: 'custom', coordinateSystem: 'cartesian2d', clip: true,
              data: [[s.reference[0][0], s.reference[0][1]]],
              renderItem: function (params, api) {
                var up = s.reference.map(function (r) { return api.coord([r[0], r[1] + tol]); });
                var lo = s.reference.map(function (r) { return api.coord([r[0], r[1] - tol]); }).reverse();
                return { type: 'polygon', shape: { points: up.concat(lo) }, style: { fill: hex(s.color, 0.15) }, silent: true };
              }
            }));
          }
          out.push(Object.assign({}, base, {
            id: 'dref' + i, type: 'line', data: s.reference, showSymbol: false, smooth: false,
            lineStyle: { type: 'dashed', width: 1.5, opacity: 0.8, color: s.color }, itemStyle: { color: s.color }
          }));
          if (viz === 'desvio') {
            out.push(Object.assign({}, base, {
              id: 'dseg' + i, type: 'custom', coordinateSystem: 'cartesian2d', clip: true,
              data: s.points, dimensions: ['x', 'y', 'raw', 'acc', 'ref'], encode: { x: 0, y: 1 },
              renderItem: function (params, api) {
                var a = api.coord([api.value(0), api.value(1)]);
                var b = api.coord([api.value(0), api.value(4)]);
                return {
                  type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] },
                  style: { stroke: MS.accuracyColor(api.value(3)), lineWidth: 2 }, silent: true
                };
              }
            }));
          }
        });
      }
      return out;
    }

    // Curve fills: one silent custom series (id 'fills', last, below the lines). Polygons live in a JS array;
    // data items only carry the index, so a redraw is a cheap data-only merge by id.
    var fillPolys = [];
    function fillData() {
      var active = core.getFilter();
      fillPolys = [];
      core.fills().forEach(function (f) {
        f.polygons.forEach(function (pts) {
          fillPolys.push({ pts: pts, color: hex(f.color, active === f.seriesIndex ? 0.35 : 0.22) });
        });
      });
      return fillPolys.map(function (_, k) { return [k, 0]; });
    }
    function fillsSeries() {
      return {
        id: 'fills', type: 'custom', coordinateSystem: 'cartesian2d', clip: true, silent: true,
        tooltip: { show: false }, legendHoverLink: false, z: 0.5, data: fillData(),
        renderItem: function (params, api) {
          var poly = fillPolys[api.value(0)];
          if (!poly) return null;
          return { type: 'polygon', shape: { points: poly.pts.map(function (q) { return api.coord(q); }) },
            style: { fill: poly.color, stroke: 'none' }, silent: true };
        }
      };
    }
    function drawFills() { chart.setOption({ series: [{ id: 'fills', data: fillData() }] }); }

    // Updates highlight, labels and decorations; replaceMerge keeps dataZoom (it is not a series).
    function applyFilter(active) {
      var focus = MS.focus(active);
      chart.setOption({ series: mainSeries(active, focus, false).concat(decorations(focus), [fillsSeries()]) }, { replaceMerge: ['series'] });
    }

    var ds = root.MoonSeries.dataset;
    var spurious = ds.kind === 'spurious';
    var ptbr = function (v, d) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }); };
    var mouseY = null; // last pointer y (px), used to pick the nearest curve in the tooltip
    chart.getZr().on('mousemove', function (e) { mouseY = e.offsetY; });

    var axisBase = {
      type: 'value',
      axisLine: { lineStyle: { color: MUTED } },
      axisLabel: { color: MUTED, fontFamily: 'Fira Code, monospace' },
      splitLine: { lineStyle: { color: GRID } },
      nameTextStyle: { color: MUTED }
    };

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      color: series.map(function (s) { return s.color; }),
      textStyle: { fontFamily: 'Overpass, sans-serif', color: TEXT },
      grid: { left: 56, right: 72, top: 104, bottom: 84 },
      legend: {
        data: series.map(function (s) { return s.name; }),
        type: 'scroll',
        top: 44,
        left: 'center',
        width: '86%',
        pageIconColor: ACCENT,
        pageIconInactiveColor: '#5A6A94',
        pageTextStyle: { color: MUTED },
        textStyle: { color: TEXT, fontFamily: 'Overpass, sans-serif' },
        inactiveColor: '#5A6A94'
      },
      toolbox: {
        right: 16,
        top: 8,
        iconStyle: { borderColor: MUTED },
        emphasis: { iconStyle: { borderColor: ACCENT } },
        feature: {
          restore: { title: 'Restaurar' },
          saveAsImage: { title: 'Salvar PNG', name: 'moonwatch', backgroundColor: BG }
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(7, 23, 63, 0.95)',
        borderColor: MUTED,
        textStyle: { color: TEXT, fontFamily: 'Overpass, sans-serif' },
        axisPointer: { type: 'line', lineStyle: { color: MUTED } },
        formatter: function (params) {
          params = params.filter(function (p) { return p.seriesIndex < series.length; });
          if (!params.length) return '';
          var mono = 'font-family:\'Fira Code\',monospace;';
          var head = ds.xIsYear ? String(Math.round(params[0].value[0])) : 'x = ' + ptbr(params[0].value[0], 3);
          var list = params;
          if (!spurious) { // 20 curves: show only the one nearest to the pointer
            var best = Infinity;
            params.forEach(function (p) {
              var py = chart.convertToPixel({ yAxisIndex: 0 }, p.value[1]);
              var d = mouseY === null ? 0 : Math.abs(py - mouseY);
              if (d < best) { best = d; list = [p]; }
            });
          }
          var rows = list.map(function (p) {
            var val = spurious
              ? ptbr(p.value[2], 6) + ' ' + (series[p.seriesIndex].unit || '')
              : 'y = ' + ptbr(p.value[1], 3);
            val += ' · Assertividade: ' + p.value[3] + '%';
            if (p.value[4] !== null && p.value[4] !== undefined) {
              val += '<br>Referência: ' + ptbr(p.value[4], 3) + ' · Desvio: ' + ptbr(p.value[1] - p.value[4], 3);
            }
            return p.marker + p.seriesName + ': <span style="' + mono + 'float:right;margin-left:16px">' + val + '</span>';
          });
          return '<div style="' + mono + 'color:' + MUTED + '">' + head + '</div>' + rows.join('<br>');
        }
      },
      xAxis: Object.assign({}, axisBase, {
        name: ds.xLabel, nameLocation: 'middle', nameGap: 22, min: ds.xRange[0], max: ds.xRange[1],
        minInterval: ds.xIsYear ? 1 : 0,
        axisLabel: Object.assign({}, axisBase.axisLabel, ds.xIsYear ? { formatter: function (v) { return String(Math.round(v)); } } : {})
      }),
      yAxis: Object.assign({}, axisBase, { name: ds.yLabel, nameTextStyle: { color: MUTED, align: 'left' }, min: ds.yRange[0], max: ds.yRange[1] }),
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          bottom: 16,
          height: 28,
          borderColor: GRID,
          backgroundColor: 'rgba(255,255,255,0.04)',
          fillerColor: 'rgba(234, 254, 7, 0.15)',
          handleStyle: { color: ACCENT, borderColor: ACCENT },
          moveHandleStyle: { color: MUTED },
          textStyle: { color: MUTED, fontFamily: 'Fira Code, monospace' },
          dataBackground: { lineStyle: { color: MUTED, opacity: 0.4 }, areaStyle: { opacity: 0.05 } }
        }
      ],
      series: mainSeries(null, [], true)
    });

    // Click on a line selects it; click on empty plot (no zr target) clears.
    chart.on('click', { seriesType: 'line' }, function (e) {
      if (e.seriesIndex < series.length) core.setFilter(e.seriesIndex);
    });
    chart.getZr().on('click', function (e) {
      if (!e.target && Date.now() - lastDragAt > 300) core.setFilter(null);
    });

    // Draggable horizontal line: graphic group (dashed line + hit area + arrow + value label).
    var LINE = core.line;
    var lastSig = '';
    var lastDragAt = 0;
    function drawLine() {
      var gm = chart.getModel().getComponent('grid');
      if (!gm || !gm.coordinateSystem) return;
      var rect = gm.coordinateSystem.getRect();
      var v = LINE.get();
      var py = chart.convertToPixel({ yAxisIndex: 0 }, v);
      var hidden = !isFinite(py) || py < rect.y - 0.5 || py > rect.y + rect.height + 0.5;
      var sig = [rect.x, rect.y, rect.width, rect.height, py, v].join('|');
      if (sig === lastSig) return;
      lastSig = sig;
      var drag = {
        draggable: true, cursor: 'ns-resize', z: 100, invisible: hidden,
        ondrag: function (e) {
          lastDragAt = Date.now();
          LINE.set(chart.convertFromPixel({ yAxisIndex: 0 }, e.offsetY), 'drag');
        }
      };
      var right = rect.x + rect.width;
      chart.setOption({ graphic: { elements: [{
        id: 'hline', type: 'group', x: 0, y: 0, z: 100, children: [
          Object.assign({ id: 'hline-line', type: 'line', x: rect.x, y: py,
            shape: { x1: 0, y1: 0, x2: rect.width, y2: 0 },
            style: { stroke: ACCENT, lineWidth: 2, lineDash: [6, 4] } }, drag),
          Object.assign({ id: 'hline-hit', type: 'rect', x: rect.x, y: py - 6,
            shape: { x: 0, y: 0, width: rect.width, height: 12 }, style: { fill: 'rgba(0,0,0,0)' } }, drag),
          Object.assign({ id: 'hline-arrow', type: 'polygon', x: right + 2, y: py,
            shape: { points: [[0, 0], [12, -7], [12, 7]] }, style: { fill: ACCENT } }, drag),
          Object.assign({ id: 'hline-text', type: 'text', x: right + 18, y: py,
            style: { text: isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
              fill: ACCENT, font: '11px "Fira Code", monospace', textVerticalAlign: 'middle' } }, drag)
        ]
      }] } });
    }
    // Draggable vertical lines: one graphic group per line (id 'vline-<id>'), geometry in absolute pixels.
    var VL = core.vlines;
    var vSig = '';
    var vPrevIds = [];
    function drawVLines() {
      var gm = chart.getModel().getComponent('grid');
      if (!gm || !gm.coordinateSystem) return;
      var rect = gm.coordinateSystem.getRect();
      var items = VL.list().map(function (l, n) {
        var px = chart.convertToPixel({ xAxisIndex: 0 }, l.value);
        return { id: l.id, n: n, px: px, hidden: !isFinite(px) || px < rect.x - 0.5 || px > rect.x + rect.width + 0.5 };
      });
      var sig = [rect.x, rect.y, rect.width, rect.height].concat(items.map(function (it) { return it.id + ':' + it.px + ':' + it.n; })).join('|');
      if (sig === vSig) return;
      vSig = sig;
      var ids = items.map(function (it) { return it.id; });
      var elements = vPrevIds.filter(function (id) { return ids.indexOf(id) < 0; })
        .map(function (id) { return { id: 'vline-' + id, $action: 'remove' }; });
      vPrevIds = ids;
      var top = rect.y, bottom = rect.y + rect.height, cy = top - 8; // handle center: 8 px above the plot
      items.forEach(function (it) {
        var cx = it.px, p = it.id;
        var drag = {
          draggable: true, cursor: 'ew-resize', z: 100, invisible: it.hidden,
          ondrag: function (e) {
            lastDragAt = Date.now();
            if (e.target) { e.target.x = 0; e.target.y = 0; } // geometry is absolute; only the redraw moves it
            VL.set(it.id, chart.convertFromPixel({ xAxisIndex: 0 }, e.offsetX), 'drag');
          },
          ondragend: function () { lastDragAt = Date.now(); vSig = ''; drawVLines(); }
        };
        elements.push({
          id: 'vline-' + p, type: 'group', x: 0, y: 0, z: 100, invisible: it.hidden, children: [
            Object.assign({ id: 'vline-' + p + '-line', type: 'line', x: 0, y: 0,
              shape: { x1: cx, y1: top, x2: cx, y2: bottom },
              style: { stroke: MoonCore.vlineColor(it.n), opacity: 0.85, lineWidth: 1.5, lineDash: [6, 4] } }, drag), // color of series n
            Object.assign({ id: 'vline-' + p + '-hit', type: 'rect', x: 0, y: 0,
              shape: { x: cx - 5, y: top, width: 10, height: rect.height }, style: { fill: 'rgba(0,0,0,0)' } }, drag),
            Object.assign({ id: 'vline-' + p + '-arrow', type: 'polygon', x: 0, y: 0,
              shape: { points: [[cx - 6, cy - 5], [cx + 6, cy - 5], [cx, cy + 5]] }, style: { fill: MoonCore.vlineColor(it.n) } }, drag),
            Object.assign({ id: 'vline-' + p + '-text', type: 'text', x: 0, y: 0,
              style: { text: 'V' + (it.n + 1), x: cx + 9, y: cy, fill: MoonCore.vlineColor(it.n),
                font: '11px "Fira Code", monospace', textVerticalAlign: 'middle' } }, drag)
          ]
        });
      });
      chart.setOption({ graphic: { elements: elements } });
    }

    function drawAll() { drawLine(); drawVLines(); }
    LINE.onChange(function () { drawLine(); drawFills(); });
    VL.onChange(function () { drawVLines(); drawFills(); });
    chart.on('datazoom', drawAll);
    // 'finished' can fire inside ECharts' main process, where setOption is silently ignored: defer it.
    chart.on('finished', function () { setTimeout(drawAll, 0); }); // signature checks prevent loops
    drawAll();

    core.onFilterChange(applyFilter);
    applyFilter(core.getFilter());

    // Toolbox "restore" resets the option, so reapply the current highlight.
    chart.on('restore', function () { applyFilter(core.getFilter()); });

    var resetBtn = root.MoonLayout && root.MoonLayout.resetZoomButton;
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
      });
    }

    function resize() { chart.resize(); }
    root.addEventListener('resize', resize);
    if (root.ResizeObserver) new root.ResizeObserver(resize).observe(container);

    return chart;
  }

  root.MoonChart = { render: render };
})(window);

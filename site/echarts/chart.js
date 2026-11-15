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
          o.encode = { x: 'x', y: 'y' }; o.showSymbol = viz === 'cor'; o.symbolSize = 7; // lines only; 'cor' needs markers to show accuracy
          o.triggerLineEvent = true; o.smooth = false; o.emphasis = { disabled: true };
        }
        return o;
      });
    }

    // Decoration series: silent, no tooltip, appended after the main ones, ids d*.
    function decorations(focus) {
      var out = [];
      var base = { silent: true, tooltip: { show: false }, legendHoverLink: false, z: 1 };
      if (viz === 'faixa') {
        focus.forEach(function (i) {
          var s = series[i];
          out.push(Object.assign({}, base, {
              id: 'dband' + i, type: 'custom', coordinateSystem: 'cartesian2d', clip: true,
              data: [[s.reference[0][0], s.reference[0][1]]],
              renderItem: function (params, api) {
                var up = s.reference.map(function (r) { return api.coord([r[0], r[1] + tol]); });
                var lo = s.reference.map(function (r) { return api.coord([r[0], r[1] - tol]); }).reverse();
                return { type: 'polygon', shape: { points: up.concat(lo) }, style: { fill: hex(s.color, 0.15) }, silent: true };
              }
            }));
          out.push(Object.assign({}, base, {
            id: 'dref' + i, type: 'line', data: s.reference, showSymbol: false, smooth: false,
            lineStyle: { type: 'dashed', width: 1.5, opacity: 0.8, color: s.color }, itemStyle: { color: s.color }
          }));
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

    var lastDragAt = 0;
    // Draggable guide lines: ONE flat graphic list (all 'hline-<id>' and 'vline-<id>' groups, children always
    // inside their group) applied with replaceMerge, so ids that vanish are removed and never re-added in the same call.
    // Only the arrow handles (H: right of the plot, V: above it) are draggable; lines and labels are silent.
    var HL = core.hlines;
    var VL = core.vlines;
    var gSig = '';
    function drawGuides() {
      var gm = chart.getModel().getComponent('grid');
      if (!gm || !gm.coordinateSystem) return;
      var rect = gm.coordinateSystem.getRect();
      var hs = [], vs = [];
      HL.list().forEach(function (l, n) {
        if (!core.hlineVisible(n)) return; // hidden series: draw nothing
        var py = chart.convertToPixel({ yAxisIndex: 0 }, l.value);
        hs.push({ id: l.id, n: n, py: py, hidden: !isFinite(py) || py < rect.y - 0.5 || py > rect.y + rect.height + 0.5 });
      });
      VL.list().forEach(function (l, n) {
        if (!core.vlineVisible(n)) return;
        var px = chart.convertToPixel({ xAxisIndex: 0 }, l.value);
        vs.push({ id: l.id, n: n, px: px, hidden: !isFinite(px) || px < rect.x - 0.5 || px > rect.x + rect.width + 0.5 });
      });
      var sig = [rect.x, rect.y, rect.width, rect.height]
        .concat(hs.map(function (it) { return 'h' + it.id + ':' + it.py + ':' + it.n; }))
        .concat(vs.map(function (it) { return 'v' + it.id + ':' + it.px + ':' + it.n; })).join('|');
      if (sig === gSig) return;
      gSig = sig;
      var elements = [];
      var left = rect.x, right = rect.x + rect.width, top = rect.y, bottom = rect.y + rect.height;
      var hx = right + 8; // H handle center: 8 px right of the plot
      var vy = top - 8;   // V handle center: 8 px above the plot
      var lineStyle = function (color) { return { stroke: color, opacity: 0.85, lineWidth: 1.5, lineDash: [6, 4] }; };
      var textStyle = function (text, x, y, color) {
        return { text: text, x: x, y: y, fill: color, font: '11px "Fira Code", monospace', textVerticalAlign: 'middle' };
      };
      hs.forEach(function (it) {
        var cy = it.py, p = 'hline-' + it.id, color = core.hlineColor(it.n);
        elements.push({
          id: p, type: 'group', x: 0, y: 0, z: 100, invisible: it.hidden, children: [
            { id: p + '-line', type: 'line', x: 0, y: 0, z: 100, silent: true, invisible: it.hidden,
              shape: { x1: left, y1: cy, x2: right, y2: cy }, style: lineStyle(color) },
            { id: p + '-arrow', type: 'polygon', x: 0, y: 0, z: 100, invisible: it.hidden,
              draggable: true, cursor: 'ns-resize',
              shape: { points: [[hx - 6, cy], [hx + 6, cy - 5], [hx + 6, cy + 5]] }, style: { fill: color },
              ondrag: function (e) {
                lastDragAt = Date.now();
                if (e.target) { e.target.x = 0; e.target.y = 0; } // geometry is absolute; only the redraw moves it
                HL.set(it.id, chart.convertFromPixel({ yAxisIndex: 0 }, e.offsetY), 'drag');
              },
              ondragend: function () { lastDragAt = Date.now(); gSig = ''; drawGuides(); } },
            { id: p + '-text', type: 'text', x: 0, y: 0, z: 100, silent: true, invisible: it.hidden,
              style: textStyle(MoonCore.hlineLabel(it.n), hx + 10, cy, color) }
          ]
        });
      });
      vs.forEach(function (it) {
        var cx = it.px, p = 'vline-' + it.id, color = core.vlineColor(it.n);
        elements.push({
          id: p, type: 'group', x: 0, y: 0, z: 100, invisible: it.hidden, children: [
            { id: p + '-line', type: 'line', x: 0, y: 0, z: 100, silent: true, invisible: it.hidden,
              shape: { x1: cx, y1: top, x2: cx, y2: bottom }, style: lineStyle(color) },
            { id: p + '-arrow', type: 'polygon', x: 0, y: 0, z: 100, invisible: it.hidden,
              draggable: true, cursor: 'ew-resize',
              shape: { points: [[cx - 6, vy - 5], [cx + 6, vy - 5], [cx, vy + 5]] }, style: { fill: color },
              ondrag: function (e) {
                lastDragAt = Date.now();
                if (e.target) { e.target.x = 0; e.target.y = 0; }
                VL.set(it.id, chart.convertFromPixel({ xAxisIndex: 0 }, e.offsetX), 'drag');
              },
              ondragend: function () { lastDragAt = Date.now(); gSig = ''; drawGuides(); } },
            { id: p + '-text', type: 'text', x: 0, y: 0, z: 100, silent: true, invisible: it.hidden,
              style: textStyle('V' + (it.n + 1), cx + 9, vy, color) }
          ]
        });
      });
      chart.setOption({ graphic: { elements: elements } }, { replaceMerge: ['graphic'] });
    }

    function drawAll() { drawGuides(); }
    HL.onChange(function () { drawGuides(); drawFills(); });
    VL.onChange(function () { drawGuides(); drawFills(); });
    // Legend toggle -> shared visibility; the redraw happens in onVisibilityChange.
    chart.on('legendselectchanged', function (e) {
      series.forEach(function (s, k) { core.setVisible(k, e.selected[s.name] !== false); });
    });
    core.onVisibilityChange(function () { drawGuides(); drawFills(); });
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

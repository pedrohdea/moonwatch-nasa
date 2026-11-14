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

    function seriesStyle(active, i) {
      var dim = active !== null && active !== i;
      return {
        lineStyle: { width: active === i ? 4 : 2, opacity: dim ? 0.15 : 1 },
        itemStyle: { color: series[i].color, opacity: dim ? 0.15 : 1 },
        z: active === i ? 10 : 2
      };
    }

    // Applies highlight/dim without touching dataZoom (setOption merges by series id).
    function applyFilter(active) {
      chart.setOption({
        series: series.map(function (s, i) {
          var st = seriesStyle(active, i);
          return { id: 's' + i, lineStyle: st.lineStyle, itemStyle: st.itemStyle, z: st.z };
        })
      });
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
      grid: { left: 56, right: 24, top: 104, bottom: 84 },
      legend: {
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
      series: series.map(function (s, i) {
        var st = seriesStyle(null, i);
        return {
          id: 's' + i,
          name: s.name,
          type: 'line',
          data: s.points,
          dimensions: ['x', 'y', 'raw', 'acc'],
          encode: { x: 'x', y: 'y' },
          showSymbol: true,
          symbolSize: function (value) { return 3 + 7 * (value[3] / 100); },
          triggerLineEvent: true,
          smooth: false,
          lineStyle: st.lineStyle,
          z: st.z,
          itemStyle: st.itemStyle,
          emphasis: { disabled: true }
        };
      })
    });

    // Click on a line selects it; click on empty plot (no zr target) clears.
    chart.on('click', { seriesType: 'line' }, function (e) {
      core.setFilter(e.seriesIndex);
    });
    chart.getZr().on('click', function (e) {
      if (!e.target) core.setFilter(null);
    });

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

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
        z: active === i ? 10 : 2
      };
    }

    // Applies highlight/dim without touching dataZoom (setOption merges by series id).
    function applyFilter(active) {
      chart.setOption({
        series: series.map(function (s, i) {
          var st = seriesStyle(active, i);
          return { id: 's' + i, lineStyle: st.lineStyle, z: st.z };
        })
      });
    }

    var axisBase = {
      type: 'value',
      min: 0,
      max: 10,
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
      grid: { left: 48, right: 24, top: 80, bottom: 80 },
      legend: {
        top: 8,
        left: 'center',
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
          var x = Number(params[0].value[0]).toFixed(3);
          var rows = params.map(function (p) {
            return p.marker + p.seriesName + ': <span style="font-family:\'Fira Code\',monospace;float:right;margin-left:16px">' +
              Number(p.value[1]).toFixed(3) + '</span>';
          });
          return '<div style="font-family:\'Fira Code\',monospace;color:' + MUTED + '">x = ' + x + '</div>' + rows.join('<br>');
        }
      },
      xAxis: Object.assign({}, axisBase, { name: 'x', nameLocation: 'end' }),
      yAxis: Object.assign({}, axisBase, { name: 'y' }),
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
          showSymbol: false,
          triggerLineEvent: true,
          sampling: 'lttb',
          lineStyle: st.lineStyle,
          z: st.z,
          itemStyle: { color: s.color },
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

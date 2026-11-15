// Starts the chart adapter (MoonChart from <lib>/chart.js); shows a message if it fails.
// Switching the accuracy visualization rebuilds only the chart (filter, legend, lines and tables are kept).
(function (root) {
  'use strict';

  var el = root.MoonLayout.chartEl;
  var current = null;

  function start() {
    try {
      if (!root.MoonChart || typeof root.MoonChart.render !== 'function') throw new Error('MoonChart.render ausente');
      if (current && current.destroy) current.destroy();
      current = root.MoonChart.render(el, root.MoonSeries.all);
    } catch (err) {
      console.error(err);
      el.innerHTML = '<p class="chart-error">Não foi possível carregar o gráfico (' + root.MoonLayout.lib + '). A tabela abaixo continua disponível.</p>';
    }
  }

  start();
  if (root.MoonSeries.onVizChange) root.MoonSeries.onVizChange(start);
})(window);

// Starts the chart adapter (MoonChart from <lib>/chart.js); shows a message if it fails.
(function (root) {
  'use strict';

  var el = root.MoonLayout.chartEl;
  try {
    if (!root.MoonChart || typeof root.MoonChart.render !== 'function') throw new Error('MoonChart.render ausente');
    root.MoonChart.render(el, root.MoonSeries.all);
  } catch (err) {
    console.error(err);
    el.innerHTML = '<p class="chart-error">Não foi possível carregar o gráfico (' + root.MoonLayout.lib + '). A tabela abaixo continua disponível.</p>';
  }
})(window);

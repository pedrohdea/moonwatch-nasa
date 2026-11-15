// Starts the chart adapter (MoonChart from <lib>/chart.js); shows a message if it fails.
// Switching the accuracy visualization rebuilds only the chart (filter, legend, lines and tables are kept).
(function (root) {
  'use strict';

  var el = root.MoonLayout.chartEl;
  var current = null;

  function start() {
    try {
      if (!root.MoonChart || typeof root.MoonChart.render !== 'function') throw new Error('MoonChart.render missing');
      if (current && current.destroy) current.destroy();
      current = root.MoonChart.render(el, root.MoonSeries.all);
    } catch (err) {
      console.error(err);
      el.innerHTML = '<p class="chart-error">Could not load the chart (' + root.MoonLayout.lib + '). The table below is still available.</p>';
    }
  }

  start();
  if (root.MoonSeries.onVizChange) root.MoonSeries.onVizChange(start);
})(window);

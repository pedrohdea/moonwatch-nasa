// Fake test data: six math function families, all scaled to y in [0, 10].
(function (root) {
  'use strict';

  var X_MIN = 0;
  var X_MAX = 10;
  var STEP = 0.005;
  var EXP_NORM = Math.exp(2.5) - 1;
  var LOG_NORM = Math.log(11);

  var DEFINITIONS = [
    { name: 'Linear', formula: 'y = x', fn: function (x) { return x; } },
    { name: 'Quadrática', formula: 'y = x² / 10', fn: function (x) { return (x * x) / 10; } },
    { name: 'Cúbica', formula: 'y = x³ / 100', fn: function (x) { return (x * x * x) / 100; } },
    { name: 'Exponencial', formula: 'y = 10·(e^(x/4) − 1) / (e^2.5 − 1)', fn: function (x) { return (10 * (Math.exp(x / 4) - 1)) / EXP_NORM; } },
    { name: 'Logarítmica', formula: 'y = 10·ln(1 + x) / ln(11)', fn: function (x) { return (10 * Math.log(1 + x)) / LOG_NORM; } },
    { name: 'Senoidal', formula: 'y = 5 + 5·sin(x)', fn: function (x) { return 5 + 5 * Math.sin(x); } }
  ];

  // Contrast >= 3:1 against Deep Blue #07173F.
  var COLORS = ['#2E96F5', '#EAFE07', '#FF6A3D', '#FFFFFF', '#5CE1E6', '#C58BFF'];

  function round(value, digits) {
    var f = Math.pow(10, digits);
    return Math.round(value * f) / f;
  }

  function buildSeries() {
    var count = Math.round((X_MAX - X_MIN) / STEP) + 1;
    return DEFINITIONS.map(function (def, index) {
      var points = new Array(count);
      for (var i = 0; i < count; i++) {
        var x = round(X_MIN + i * STEP, 3); // integer step avoids float drift
        points[i] = [x, round(def.fn(x), 4)];
      }
      return { index: index, name: def.name, formula: def.formula, color: COLORS[index], points: points };
    });
  }

  // Flat table rows; seriesIndex null means all series.
  function filterRows(series, seriesIndex) {
    var picked = seriesIndex === null || seriesIndex === undefined ? series : series.filter(function (s) { return s.index === seriesIndex; });
    var rows = [];
    picked.forEach(function (s) {
      s.points.forEach(function (p) { rows.push({ seriesIndex: s.index, name: s.name, formula: s.formula, x: p[0], y: p[1] }); });
    });
    return rows;
  }

  var all = buildSeries();
  var api = { all: all, colors: COLORS, buildSeries: buildSeries, filterRows: filterRows };

  root.MoonSeries = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

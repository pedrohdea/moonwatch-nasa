// Shared data table under the chart, with infinite scroll inside its own box; follows MoonCore filter.
// Curves: one row per point. Spurious correlations: one row per year, one column per series (like tylervigen.com).
(function (root) {
  'use strict';

  var BATCH = 50;
  var doc = root.document;
  var box = doc.getElementById('table-box');
  var head = doc.getElementById('table-head');
  var body = doc.getElementById('table-body');
  var sentinel = doc.getElementById('table-sentinel');
  var badge = doc.getElementById('filter-badge');
  var clearButton = doc.getElementById('clear-filter');
  var fmt = new Intl.NumberFormat('pt-BR');
  var num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  var real = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });
  var series = root.MoonSeries.all;
  var isSpurious = root.MoonSeries.dataset.kind === 'spurious';

  var rows = [];
  var cursor = 0;
  var renderRow = null;

  function swatch(index) {
    return '<span class="swatch" style="background:' + root.MoonSeries.colors[index] + '"></span>';
  }

  function accuracyCell(value) {
    return '<td class="num mono"><span class="acc" style="--acc:' + value + '%">' + value + '%</span></td>';
  }

  // Long format: one row per chart point.
  function longTable(index) {
    var xDate = root.MoonSeries.dataset.xDate; // viability: x is a day index, shown as a date
    head.innerHTML = '<tr><th>#</th><th>' + (xDate ? 'Série' : 'Curva') + '</th>' +
      (xDate ? '<th class="num">Data</th><th class="num">Dia</th><th class="num">Viabilidade</th>' : '<th class="num">x</th><th class="num">y</th>') +
      '<th class="num">Assertividade</th></tr>';
    rows = root.MoonSeries.filterRows(series, index);
    renderRow = function (r, i) {
      return '<tr><td class="num">' + (i + 1) + '</td>' +
        '<td>' + swatch(r.seriesIndex) + r.name + '</td>' +
        (xDate ? '<td class="num mono">' + xDate(r.x) + '</td>' : '') +
        '<td class="num mono">' + (xDate ? r.x : num.format(r.x)) + '</td>' +
        '<td class="num mono">' + (xDate ? real.format(r.y) : num.format(r.y)) + '</td>' +
        accuracyCell(r.accuracy) + '</tr>';
    };
  }

  // Wide format: year + (real value, accuracy) per visible series — accuracy belongs to each series' own point.
  function wideTable(index) {
    var cols = index === null ? series : [series[index]];
    head.innerHTML = '<tr><th class="num">Ano</th>' + cols.map(function (s) {
      return '<th class="num">' + swatch(s.index) + s.name + ' <span class="unit">(' + s.unit + ')</span></th>' +
        '<th class="num">' + swatch(s.index) + 'Assertividade</th>';
    }).join('') + '</tr>';
    rows = series[0].points.map(function (p, k) { return { year: p[0], k: k }; });
    renderRow = function (r) {
      return '<tr><td class="num mono">' + r.year + '</td>' + cols.map(function (s) {
        var p = s.points[r.k];
        return '<td class="num mono">' + real.format(p[2]) + '</td>' + accuracyCell(p[3]);
      }).join('') + '</tr>';
    };
  }

  function renderBatch() {
    var end = Math.min(cursor + BATCH, rows.length);
    var html = '';
    for (var i = cursor; i < end; i++) html += renderRow(rows[i], i);
    body.insertAdjacentHTML('beforeend', html);
    cursor = end;
    sentinel.hidden = cursor >= rows.length;
  }

  var observer = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; }) && cursor < rows.length) renderBatch();
  }, { root: box, rootMargin: '200px' });

  function load(index) {
    (isSpurious ? wideTable : longTable)(index);
    cursor = 0;
    body.textContent = '';
    box.scrollTop = 0;
    renderBatch();
    // Re-observe so the sentinel fires again even if it was already visible.
    observer.unobserve(sentinel);
    observer.observe(sentinel);

    var label = index === null ? 'Todas as séries' : 'Filtro: ' + series[index].name;
    badge.textContent = label + ' — ' + fmt.format(rows.length) + ' linhas';
    var barTitle = doc.querySelector('.table-bar[data-for="table-box"] .table-bar-title');
    if (barTitle) barTitle.textContent = 'Tabela de dados (' + fmt.format(rows.length) + ' linhas)';
    badge.classList.toggle('is-active', index !== null);
    if (index !== null) badge.style.setProperty('--series-color', root.MoonSeries.colors[index]);
    clearButton.disabled = index === null;
  }

  clearButton.addEventListener('click', function () { root.MoonCore.setFilter(null); });
  root.MoonCore.onFilterChange(load);
  load(null);
})(window);

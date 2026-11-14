// Shared data table with infinite scroll inside its own box; follows MoonCore filter.
(function (root) {
  'use strict';

  var BATCH = 50;
  var doc = root.document;
  var box = doc.getElementById('table-box');
  var body = doc.getElementById('table-body');
  var sentinel = doc.getElementById('table-sentinel');
  var badge = doc.getElementById('filter-badge');
  var clearButton = doc.getElementById('clear-filter');
  var fmt = new Intl.NumberFormat('pt-BR');
  var num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 });

  var rows = [];
  var cursor = 0;

  function renderBatch() {
    var end = Math.min(cursor + BATCH, rows.length);
    var html = '';
    for (var i = cursor; i < end; i++) {
      var r = rows[i];
      html += '<tr><td class="num">' + (i + 1) + '</td>' +
        '<td><span class="swatch" style="background:' + root.MoonSeries.colors[r.seriesIndex] + '"></span>' + r.name + '</td>' +
        '<td class="mono">' + r.formula + '</td>' +
        '<td class="num mono">' + num.format(r.x) + '</td>' +
        '<td class="num mono">' + num.format(r.y) + '</td></tr>';
    }
    body.insertAdjacentHTML('beforeend', html);
    cursor = end;
    sentinel.hidden = cursor >= rows.length;
  }

  var observer = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; }) && cursor < rows.length) renderBatch();
  }, { root: box, rootMargin: '200px' });

  function load(index) {
    rows = root.MoonSeries.filterRows(root.MoonSeries.all, index);
    cursor = 0;
    body.textContent = '';
    box.scrollTop = 0;
    renderBatch();
    // Re-observe so the sentinel fires again even if it was already visible.
    observer.unobserve(sentinel);
    observer.observe(sentinel);

    var label = index === null ? 'Todas as séries' : 'Filtro: ' + root.MoonSeries.all[index].name;
    badge.textContent = label + ' — ' + fmt.format(rows.length) + ' linhas';
    badge.classList.toggle('is-active', index !== null);
    if (index !== null) badge.style.setProperty('--series-color', root.MoonSeries.colors[index]);
    clearButton.disabled = index === null;
  }

  clearButton.addEventListener('click', function () { root.MoonCore.setFilter(null); });
  root.MoonCore.onFilterChange(load);
  load(null);
})(window);

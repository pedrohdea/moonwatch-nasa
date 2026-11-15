// Shared data table under the chart, with infinite scroll inside its own box; follows MoonCore filter.
// Curves/viability: one row per point. Spurious correlations: one row per year, one column per series (like tylervigen.com).
// Text filter (#table-search) and click-to-sort headers work on the whole row set, not only the rendered batch.
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
  var search = doc.getElementById('table-search');
  var fmt = new Intl.NumberFormat('pt-BR');
  var num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  var real = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });
  var series = root.MoonSeries.all;
  var isSpurious = root.MoonSeries.dataset.kind === 'spurious';

  var allRows = []; // rows of the current series filter
  var rows = [];    // after text filter + sort (what is rendered)
  var cols = [];    // [{label, cls, html(r), text(r), sort(r)}]
  var sortCol = null;
  var sortDir = 1;
  var cursor = 0;

  function swatch(index) {
    return '<span class="swatch" style="background:' + root.MoonSeries.colors[index] + '"></span>';
  }

  function accuracyCell(value) {
    return '<td class="num mono"><span class="acc" style="--acc:' + value + '%">' + value + '%</span></td>';
  }

  function cell(cls, text) { return '<td class="' + cls + '">' + text + '</td>'; }

  // Long format: one row per chart point.
  function longColumns() {
    var xDate = root.MoonSeries.dataset.xDate; // viability: x is a day index, shown as a date
    var c = [
      { label: '#', cls: 'num', html: function (r) { return cell('num', r.n); }, text: function (r) { return String(r.n); }, sort: function (r) { return r.n; } },
      { label: xDate ? 'Série' : 'Curva', cls: '', html: function (r) { return '<td>' + swatch(r.seriesIndex) + r.name + '</td>'; }, text: function (r) { return r.name; }, sort: function (r) { return r.name; } }
    ];
    if (xDate) {
      c.push({ label: 'Data', cls: 'num', html: function (r) { return cell('num mono', xDate(r.x)); }, text: function (r) { return xDate(r.x); }, sort: function (r) { return r.x; } });
      c.push({ label: 'Dia', cls: 'num', html: function (r) { return cell('num mono', r.x); }, text: function (r) { return String(r.x); }, sort: function (r) { return r.x; } });
      c.push({ label: 'Viabilidade', cls: 'num', html: function (r) { return cell('num mono', real.format(r.y)); }, text: function (r) { return real.format(r.y); }, sort: function (r) { return r.y; } });
    } else {
      c.push({ label: 'x', cls: 'num', html: function (r) { return cell('num mono', num.format(r.x)); }, text: function (r) { return num.format(r.x); }, sort: function (r) { return r.x; } });
      c.push({ label: 'y', cls: 'num', html: function (r) { return cell('num mono', num.format(r.y)); }, text: function (r) { return num.format(r.y); }, sort: function (r) { return r.y; } });
    }
    c.push({ label: 'Assertividade', cls: 'num', html: function (r) { return accuracyCell(r.accuracy); }, text: function (r) { return r.accuracy + '%'; }, sort: function (r) { return r.accuracy; } });
    return c;
  }

  // Wide format: year + (real value, accuracy) per visible series — accuracy belongs to each series' own point.
  function wideColumns(index) {
    var shown = index === null ? series : [series[index]];
    var c = [{ label: 'Ano', cls: 'num', html: function (r) { return cell('num mono', r.year); }, text: function (r) { return String(r.year); }, sort: function (r) { return r.year; } }];
    shown.forEach(function (s) {
      c.push({
        label: swatch(s.index) + s.name + ' <span class="unit">(' + s.unit + ')</span>', cls: 'num',
        html: function (r) { return cell('num mono', real.format(s.points[r.k][2])); },
        text: function (r) { return real.format(s.points[r.k][2]); }, sort: function (r) { return s.points[r.k][2]; }
      });
      c.push({
        label: swatch(s.index) + 'Assertividade', cls: 'num',
        html: function (r) { return accuracyCell(s.points[r.k][3]); },
        text: function (r) { return s.points[r.k][3] + '%'; }, sort: function (r) { return s.points[r.k][3]; }
      });
    });
    return c;
  }

  function renderHead() {
    head.innerHTML = '<tr>' + cols.map(function (c, i) {
      var state = sortCol === i ? (sortDir > 0 ? 'ascending' : 'descending') : 'none';
      var mark = sortCol === i ? (sortDir > 0 ? ' ▲' : ' ▼') : '';
      return '<th class="sortable ' + c.cls + '" data-col="' + i + '" aria-sort="' + state + '" title="Ordenar">' + c.label + '<span class="sort-mark">' + mark + '</span></th>';
    }).join('') + '</tr>';
  }

  function renderBatch() {
    var end = Math.min(cursor + BATCH, rows.length);
    var html = '';
    for (var i = cursor; i < end; i++) html += '<tr>' + cols.map(function (c) { return c.html(rows[i]); }).join('') + '</tr>';
    body.insertAdjacentHTML('beforeend', html);
    cursor = end;
    sentinel.hidden = cursor >= rows.length;
  }

  var observer = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; }) && cursor < rows.length) renderBatch();
  }, { root: box, rootMargin: '200px' });

  function normalize(text) { return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // Text filter (any column contains the query, accent-insensitive) + sort, then re-render from the top.
  function refresh() {
    var q = normalize(search ? search.value.trim() : '');
    rows = q ? allRows.filter(function (r) { return cols.some(function (c) { return normalize(c.text(r)).indexOf(q) >= 0; }); }) : allRows.slice();
    if (sortCol !== null) {
      var key = cols[sortCol].sort;
      rows.sort(function (a, b) {
        var x = key(a), y = key(b);
        return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR', { numeric: true }) : x - y) * sortDir;
      });
    }
    renderHead();
    cursor = 0;
    body.textContent = '';
    box.scrollTop = 0;
    renderBatch();
    // Re-observe so the sentinel fires again even if it was already visible.
    observer.unobserve(sentinel);
    observer.observe(sentinel);
    var barTitle = doc.querySelector('.table-bar[data-for="table-box"] .table-bar-title');
    if (barTitle) barTitle.textContent = 'Tabela de dados (' + (q ? fmt.format(rows.length) + ' de ' : '') + fmt.format(allRows.length) + ' linhas)';
  }

  function load(index) {
    if (isSpurious) {
      cols = wideColumns(index);
      allRows = series[0].points.map(function (p, k) { return { year: p[0], k: k }; });
    } else {
      cols = longColumns();
      allRows = root.MoonSeries.filterRows(series, index).map(function (r, i) { r.n = i + 1; return r; });
    }
    if (sortCol !== null && sortCol >= cols.length) sortCol = null; // wide table lost columns
    refresh();

    var label = index === null ? 'Todas as séries' : 'Filtro: ' + series[index].name;
    badge.textContent = label + ' — ' + fmt.format(allRows.length) + ' linhas';
    badge.classList.toggle('is-active', index !== null);
    if (index !== null) badge.style.setProperty('--series-color', root.MoonSeries.colors[index]);
    clearButton.disabled = index === null;
  }

  head.addEventListener('click', function (e) {
    var th = e.target.closest('th[data-col]');
    if (!th) return;
    var i = Number(th.getAttribute('data-col'));
    sortDir = sortCol === i ? -sortDir : 1;
    sortCol = i;
    refresh();
  });
  if (search) search.addEventListener('input', refresh);
  clearButton.addEventListener('click', function () { root.MoonCore.setFilter(null); });
  root.MoonCore.onFilterChange(load);
  load(null);
})(window);

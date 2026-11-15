// Filter + click-to-sort for small, fully rendered tables (e.g. the landing-site points table).
// MoonTableKit.attach(box, input): delegated listeners; MoonTableKit.apply(box) re-applies after the table is re-rendered.
(function (root) {
  'use strict';

  var state = new WeakMap(); // box -> {input, col, dir}

  function normalize(text) { return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // Sort key of a cell: YYYY-MM-DD -> YYYYMMDD, en-US numbers ("1,234.5", "98%") -> number, else text.
  function key(text) {
    var t = text.trim();
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (d) return Number(d[1] + d[2] + d[3]);
    var n = t.replace(/%$/, '').replace(/,/g, '');
    return n !== '' && isFinite(Number(n)) ? Number(n) : normalize(t);
  }

  function apply(box) {
    var s = state.get(box);
    var table = box.querySelector('table');
    if (!s || !table) return;
    var tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows);
    if (s.col !== null) {
      rows.sort(function (a, b) {
        var x = key(a.cells[s.col].textContent), y = key(b.cells[s.col].textContent);
        var cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en-US', { numeric: true });
        return cmp * s.dir;
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
    }
    var q = normalize(s.input ? s.input.value.trim() : '');
    rows.forEach(function (r) { r.hidden = q !== '' && normalize(r.textContent).indexOf(q) < 0; });
    Array.prototype.forEach.call(table.tHead.rows[0].cells, function (th, i) {
      th.classList.add('sortable');
      th.title = 'Sort';
      th.setAttribute('aria-sort', s.col === i ? (s.dir > 0 ? 'ascending' : 'descending') : 'none');
      var mark = th.querySelector('.sort-mark') || th.appendChild(root.document.createElement('span'));
      mark.className = 'sort-mark';
      mark.textContent = s.col === i ? (s.dir > 0 ? ' ▲' : ' ▼') : '';
    });
  }

  function attach(box, input) {
    state.set(box, { input: input, col: null, dir: 1 });
    box.addEventListener('click', function (e) {
      var th = e.target.closest('thead th');
      if (!th) return;
      var s = state.get(box);
      var i = th.cellIndex;
      s.dir = s.col === i ? -s.dir : 1;
      s.col = i;
      apply(box);
    });
    if (input) input.addEventListener('input', function () { apply(box); });
    apply(box);
  }

  root.MoonTableKit = { attach: attach, apply: apply, key: key };
  if (typeof module !== 'undefined' && module.exports) module.exports = { key: key };
})(typeof window !== 'undefined' ? window : globalThis);

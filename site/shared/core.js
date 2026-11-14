// Shared state: series filter + draggable horizontal line. Chart adapters, table and toolbar listen here.
(function (root) {
  'use strict';

  function createCore(seriesCount) {
    var active = null;
    var listeners = [];

    function setFilter(index) {
      var next = Number.isInteger(index) && index >= 0 && index < seriesCount ? index : null;
      if (next === active) return;
      active = next;
      listeners.forEach(function (cb) { cb(active); });
    }

    return {
      setFilter: setFilter,
      getFilter: function () { return active; },
      onFilterChange: function (cb) { listeners.push(cb); }
    };
  }

  // Horizontal line value, clamped to [min, max] and rounded to 0.01. `source` tells listeners who moved it.
  function createLine(min, max, initial) {
    var value = null;
    var listeners = [];

    function normalize(v) {
      if (v === '' || v === null || v === undefined) return null; // Number('') would be 0
      var n = Number(v);
      if (!isFinite(n)) return null;
      return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
    }

    function set(v, source) {
      var next = normalize(v);
      if (next === null || next === value) return;
      value = next;
      listeners.forEach(function (cb) { cb(value, source); });
    }

    value = normalize(initial);
    if (value === null) value = normalize((min + max) / 2);

    return {
      get: function () { return value; },
      set: set,
      onChange: function (cb) { listeners.push(cb); },
      min: min,
      max: max
    };
  }

  // Draggable vertical lines: ordered list of {id, value}; ids are stable so adapters can track handles.
  // `step` rounds values (1 for years, 0.01 otherwise). Listeners get (lines, source).
  function createVLines(min, max, step, initial, limit) {
    var lines = [];
    var nextId = 1;
    var listeners = [];

    function normalize(v) {
      if (v === '' || v === null || v === undefined) return null; // Number('') would be 0
      var n = Number(v);
      if (!isFinite(n)) return null;
      var clamped = Math.min(max, Math.max(min, n));
      return Math.round(Math.round(clamped / step) * step * 100) / 100;
    }

    function notify(source) {
      var copy = lines.map(function (l) { return { id: l.id, value: l.value }; });
      listeners.forEach(function (cb) { cb(copy, source); });
    }

    function find(id) { return lines.filter(function (l) { return l.id === id; })[0]; }

    // New line goes to the middle of the widest free gap, so it never lands on top of another.
    function freeSpot() {
      var xs = [min].concat(lines.map(function (l) { return l.value; }).sort(function (a, b) { return a - b; }), [max]);
      var bestGap = -1;
      var bestMid = (min + max) / 2;
      for (var i = 1; i < xs.length; i++) {
        if (xs[i] - xs[i - 1] > bestGap) { bestGap = xs[i] - xs[i - 1]; bestMid = (xs[i] + xs[i - 1]) / 2; }
      }
      return bestMid;
    }

    function add(value, source) {
      if (lines.length >= limit) return null;
      var v = normalize(value === undefined || value === null ? freeSpot() : value);
      if (v === null) return null;
      var line = { id: nextId++, value: v };
      lines.push(line);
      notify(source);
      return line.id;
    }

    (initial || []).forEach(function (v) { if (lines.length < limit && normalize(v) !== null) lines.push({ id: nextId++, value: normalize(v) }); });

    return {
      list: function () { return lines.map(function (l) { return { id: l.id, value: l.value }; }); },
      add: add,
      remove: function (id, source) {
        var before = lines.length;
        lines = lines.filter(function (l) { return l.id !== id; });
        if (lines.length !== before) notify(source);
      },
      set: function (id, value, source) {
        var line = find(id);
        var v = normalize(value);
        if (!line || v === null || v === line.value) return;
        line.value = v;
        notify(source);
      },
      onChange: function (cb) { listeners.push(cb); },
      min: min,
      max: max,
      step: step,
      limit: limit
    };
  }

  // One vertical line per chart series (default and maximum), evenly spaced: k/(n+1) of the x range.
  function defaultVLines(min, max, count) {
    var out = [];
    for (var k = 1; k <= count; k++) out.push(min + ((max - min) * k) / (count + 1));
    return out;
  }

  var api = root.MoonSeries ? createCore(root.MoonSeries.all.length) : null;
  if (api) {
    var ds = root.MoonSeries.dataset;
    var range = ds.yRange;
    var params = new URLSearchParams(root.location && root.location.search ? root.location.search : '');
    var initial = params.get('linha');
    var vparam = params.get('vlinhas'); // "" = user removed all lines; absent = defaults
    api.createCore = createCore;
    api.line = createLine(range[0], range[1], initial === null ? NaN : initial);
    var seriesCount = root.MoonSeries.all.length;
    api.vlines = createVLines(ds.xRange[0], ds.xRange[1], ds.xIsYear ? 1 : 0.01,
      vparam === null ? defaultVLines(ds.xRange[0], ds.xRange[1], seriesCount) : vparam.split(',').filter(Boolean), seriesCount);
    // Line k (order of list()) takes the color of series k, so each vertical line maps to one chart line.
    api.vlineColor = function (k) { return root.MoonSeries.colors[k % seriesCount]; };
    root.MoonCore = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createCore: createCore, createLine: createLine, createVLines: createVLines, defaultVLines: defaultVLines };
})(typeof window !== 'undefined' ? window : globalThis);

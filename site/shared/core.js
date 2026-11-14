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

  // Fill regions of one series: area between the curve and the horizontal line y = h, only where the
  // curve is above h AND x >= v (right of the series' vertical line). Straight segments, linear crossings.
  // Returns polygons in data units: [[x, y], ...], each closed along y = h.
  function fillRegions(points, h, v) {
    var pts = [];
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p[0] < v) continue;
      var prev = points[i - 1];
      if (prev && prev[0] < v && p[0] > prev[0]) pts.push([v, prev[1] + ((p[1] - prev[1]) * (v - prev[0])) / (p[0] - prev[0])]);
      pts.push([p[0], p[1]]);
    }
    var polys = [];
    var cur = null;
    for (var k = 0; k < pts.length; k++) {
      var x = pts[k][0];
      var y = pts[k][1];
      var last = pts[k - 1];
      if (last && (last[1] - h) * (y - h) < 0) {
        var xc = last[0] + ((h - last[1]) * (x - last[0])) / (y - last[1]);
        if (cur) { cur.push([xc, h]); polys.push(cur); cur = null; } else cur = [[xc, h]];
      }
      if (y >= h) {
        if (!cur) cur = [[x, h]];
        cur.push([x, y]);
      } else if (cur) { // previous point sat exactly on h
        cur.push([last[0], h]); polys.push(cur); cur = null;
      }
    }
    if (cur) { cur.push([pts[pts.length - 1][0], h]); polys.push(cur); }
    return polys.filter(function (poly) { return poly.length >= 3; });
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
    // Fills to draw now: [{seriesIndex, color, polygons}] — all series, or only the filtered one.
    // Series k uses vertical line k; a series without a vertical line (removed) gets no fill.
    api.fills = function () {
      var lines = api.vlines.list();
      var h = api.line.get();
      var active = api.getFilter();
      return root.MoonSeries.all
        .filter(function (s) { return (active === null || s.index === active) && lines[s.index]; })
        .map(function (s) {
          return { seriesIndex: s.index, color: s.color, polygons: fillRegions(s.points, h, lines[s.index].value) };
        });
    };
    api.fillRegions = fillRegions;
    root.MoonCore = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createCore: createCore, createLine: createLine, createVLines: createVLines, defaultVLines: defaultVLines, fillRegions: fillRegions };
})(typeof window !== 'undefined' ? window : globalThis);

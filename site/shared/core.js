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

    // Series visibility (legend toggles reported by the chart adapters). Vertical lines, fills and
    // area cards follow it, so their number always matches the lines shown in the chart.
    var visible = [];
    for (var i = 0; i < seriesCount; i++) visible.push(true);
    var visibilityListeners = [];

    function setVisible(index, value) {
      if (!(index >= 0 && index < seriesCount) || visible[index] === !!value) return;
      visible[index] = !!value;
      visibilityListeners.forEach(function (cb) { cb(index, visible[index]); });
    }

    return {
      setFilter: setFilter,
      getFilter: function () { return active; },
      onFilterChange: function (cb) { listeners.push(cb); },
      setVisible: setVisible,
      isVisible: function (index) { return visible[index] !== false; },
      visibleCount: function () { return visible.filter(Boolean).length; },
      onVisibilityChange: function (cb) { visibilityListeners.push(cb); }
    };
  }

  // Draggable guide lines (vertical or horizontal): ordered list of {id, value}; ids are stable so adapters can track handles.
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

  // Polygon area (shoelace), absolute value, in data units (x unit × y unit).
  function polygonArea(poly) {
    var sum = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i];
      var b = poly[(i + 1) % poly.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) / 2;
  }

  var api = root.MoonSeries ? createCore(root.MoonSeries.all.length) : null;
  if (api) {
    var ds = root.MoonSeries.dataset;
    var params = new URLSearchParams(root.location && root.location.search ? root.location.search : '');
    var seriesCount = root.MoonSeries.all.length;
    // "" in the URL = user removed all lines; absent = one line per series, evenly spaced.
    function initialLines(param, min, max) {
      var v = params.get(param);
      return v === null ? defaultVLines(min, max, seriesCount) : v.split(',').filter(Boolean);
    }
    api.createCore = createCore;
    api.vlines = createVLines(ds.xRange[0], ds.xRange[1], ds.xIsYear ? 1 : 0.01, initialLines('vlinhas', ds.xRange[0], ds.xRange[1]), seriesCount);
    // Minimum viability: ONE horizontal line shared by every series (default: middle of the y range).
    var minimaParam = params.get('minima');
    api.hlines = createVLines(ds.yRange[0], ds.yRange[1], 0.01,
      [minimaParam !== null && minimaParam !== '' ? minimaParam : (ds.yRange[0] + ds.yRange[1]) / 2], 1);
    // Vertical line k takes the color of series k; the minimum-viability line is Neon Yellow.
    api.vlineColor = function (k) { return root.MoonSeries.colors[k % seriesCount]; };
    api.hlineColor = function () { return '#EAFE07'; };
    api.hlineLabel = function () { return 'Mín.'; };

    // Series k is filled/measured with its vertical line Vk and the shared minimum-viability line.
    function pairFor(k) {
      var v = api.vlines.list()[k];
      var h = api.hlines.list()[0];
      return v && h ? { h: h.value, v: v.value } : null;
    }

    // Fills to draw now: [{seriesIndex, color, polygons}] — visible series, all or only the filtered one.
    api.fills = function () {
      var active = api.getFilter();
      return root.MoonSeries.all
        .filter(function (s) { return (active === null || s.index === active) && api.isVisible(s.index) && pairFor(s.index); })
        .map(function (s) {
          var p = pairFor(s.index);
          return { seriesIndex: s.index, color: s.color, polygons: fillRegions(s.points, p.h, p.v) };
        });
    };
    api.fillRegions = fillRegions;
    // Filled area per series (above the minimum viability, right of Vk), independent of the series filter.
    api.areas = function () {
      return root.MoonSeries.all
        .filter(function (s) { return api.isVisible(s.index) && pairFor(s.index); })
        .map(function (s) {
          var p = pairFor(s.index);
          var area = fillRegions(s.points, p.h, p.v).reduce(function (sum, poly) { return sum + polygonArea(poly); }, 0);
          return { label: 'V' + (s.index + 1), seriesIndex: s.index, name: s.name, color: s.color, area: area };
        });
    };
    // Line k (vertical or horizontal) is drawn only while series k is visible in the chart.
    api.vlineVisible = function (k) { return k < seriesCount && api.isVisible(k); };
    api.hlineVisible = function () { return true; }; // shared line: never tied to one series
    root.MoonCore = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createCore: createCore, createVLines: createVLines, defaultVLines: defaultVLines, fillRegions: fillRegions, polygonArea: polygonArea };
})(typeof window !== 'undefined' ? window : globalThis);

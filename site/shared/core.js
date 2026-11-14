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

  var api = root.MoonSeries ? createCore(root.MoonSeries.all.length) : null;
  if (api) {
    var range = root.MoonSeries.dataset.yRange;
    var initial = root.location && root.location.search ? new URLSearchParams(root.location.search).get('linha') : null;
    api.createCore = createCore;
    api.line = createLine(range[0], range[1], initial === null ? NaN : initial);
    root.MoonCore = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createCore: createCore, createLine: createLine };
})(typeof window !== 'undefined' ? window : globalThis);

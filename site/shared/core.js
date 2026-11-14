// Shared filter state: chart adapters and the table both listen here.
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

  var api = root.MoonSeries ? createCore(root.MoonSeries.all.length) : null;
  if (api) { api.createCore = createCore; root.MoonCore = api; }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createCore: createCore };
})(typeof window !== 'undefined' ? window : globalThis);

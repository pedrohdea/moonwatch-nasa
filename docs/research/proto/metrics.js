// Window metrics from hourly visibility flags. Works in browser (window.siteMetrics) and Node (module.exports).
(function (root) {
  // Longest run of consecutive `false` in flags, in samples.
  function longestGap(flags) {
    let best = 0, cur = 0;
    for (const f of flags) { cur = f ? 0 : cur + 1; if (cur > best) best = cur; }
    return best;
  }

  // samples: [{sun:{az,el}, earth:{az,el}}], mask: 360 horizon elevations (deg), minEarthEl: DTE margin (deg).
  function siteMetrics(samples, mask, minEarthEl, stepHours) {
    const m = (az) => mask[Math.floor(az) % 360];
    const sun = samples.map((s) => s.sun.el > m(s.sun.az));
    const earth = samples.map((s) => s.earth.el > Math.max(m(s.earth.az), minEarthEl));
    const both = sun.map((s, i) => s && earth[i]);
    const pct = (a) => (a.length ? (100 * a.filter(Boolean).length) / a.length : 0);
    return {
      flags: { sun, earth, both },
      sunlitPct: pct(sun),
      longestDarkH: longestGap(sun) * stepHours,
      dtePct: pct(earth),
      longestBlackoutH: longestGap(earth) * stepHours,
      bothPct: pct(both),
    };
  }

  const api = { siteMetrics, longestGap };
  if (typeof module !== 'undefined') module.exports = api; else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);

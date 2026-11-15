import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { siteMetrics, longestGap } = createRequire(import.meta.url)('./metrics.js');

test('longestGap counts consecutive false', () => {
  assert.equal(longestGap([true, false, false, true, false]), 2);
  assert.equal(longestGap([]), 0);
});

test('siteMetrics applies mask and DTE margin', () => {
  const mask = new Array(360).fill(1); // terrain 1 deg everywhere
  const s = (sunEl, earthEl) => ({ sun: { az: 10, el: sunEl }, earth: { az: 200, el: earthEl } });
  const r = siteMetrics([s(2, 6), s(0.5, 3), s(0.5, 0), s(2, 6)], mask, 5, 1);
  assert.deepEqual(r.flags.sun, [true, false, false, true]);
  assert.deepEqual(r.flags.earth, [true, false, false, true]); // 3 deg above mask but below 5 deg margin
  assert.equal(r.sunlitPct, 50);
  assert.equal(r.longestDarkH, 2);
  assert.equal(r.longestBlackoutH, 2);
  assert.equal(r.bothPct, 50);
});

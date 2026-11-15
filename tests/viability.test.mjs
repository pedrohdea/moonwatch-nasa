// Viability dataset: generated data (site/shared/data/viability.js) + series built in site/shared/series.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
require('../site/shared/data/viability.js'); // sets globalThis.MoonViability before series.js reads it
const MoonSeries = require('../site/shared/series.js');

test('generated data: 10 groups x 731 days, mean matches the raw CSV', () => {
  const V = globalThis.MoonViability;
  assert.equal(V.start, '2024-01-01');
  assert.equal(V.days, 731);
  assert.equal(V.groups.length, 10);
  // recompute group 1 day 0 and group 10 last day from the source CSV
  const raw = readFileSync(new URL('../docs/fLandingSites_viability.csv', import.meta.url), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  const mean = (sites, date) => {
    const vs = raw.filter((c) => sites.includes(Number(c[0])) && c[1] === date).map((c) => Number(c[2]));
    return Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10;
  };
  assert.equal(V.groups[0].mean[0], mean(V.groups[0].sites, '2024-01-01'));
  assert.equal(V.groups[9].mean[730], mean(V.groups[9].sites, '2025-12-31'));
});

test('viability series: 10 x 731 points following the point contract', () => {
  const ds = MoonSeries.datasets.find((d) => d.key === 'viabilidade');
  assert.ok(ds);
  const series = MoonSeries.load('viabilidade');
  assert.equal(series.length, 10);
  for (const s of series) {
    assert.equal(s.points.length, 731);
    s.points.forEach((p, i) => {
      assert.equal(p[0], i);
      assert.ok(p[1] >= 0 && p[1] <= 200);
      assert.ok(p[3] >= 0 && p[3] <= 100);
      assert.ok(Math.abs(Math.abs(p[1] - p[4]) - (1 - p[3] / 100) * 50) <= 0.51, `acc ${p[3]} vs |y-ref| ${Math.abs(p[1] - p[4])}`);
    });
  }
});

test('generated data: total VIABILITY per site matches the raw CSV', () => {
  const V = globalThis.MoonViability;
  const raw = readFileSync(new URL('../docs/fLandingSites_viability.csv', import.meta.url), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  assert.equal(Object.keys(V.siteTotals).length, 50);
  for (const id of ['1', '27', '50']) {
    const sum = raw.filter((c) => c[0] === id).reduce((a, c) => a + Number(c[2]), 0);
    assert.equal(V.siteTotals[id], Math.round(sum * 100) / 100, `site ${id}`);
  }
});

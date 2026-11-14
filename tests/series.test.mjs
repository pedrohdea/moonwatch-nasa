// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MoonSeries = require('../site/shared/series.js');
const { createCore } = require('../site/shared/core.js');

const near = (a, b) => Math.abs(a - b) < 1e-3;

test('default dataset: 20 curves, 21 measured points, x and y within [0, 10], accuracy 75–100', () => {
  assert.equal(MoonSeries.dataset.key, 'curvas');
  assert.equal(MoonSeries.all.length, 20);
  for (const s of MoonSeries.all) {
    assert.equal(s.points.length, 21, s.name);
    assert.ok(near(s.points[0][0], 0) && near(s.points.at(-1)[0], 10), `${s.name} x range`);
    for (const [x, y, raw, acc] of s.points) {
      assert.ok(x >= 0 && x <= 10 && y >= 0 && y <= 10, `${s.name} x=${x} y=${y}`);
      assert.equal(raw, null);
      assert.ok(Number.isInteger(acc) && acc >= 75 && acc <= 100, `${s.name} accuracy=${acc}`);
    }
    assert.match(s.color, /^#[0-9A-F]{6}$/, `${s.name} color must be hex (Chart.js dims it with alpha)`);
    assert.equal(s.formula, undefined, 'formula is not exposed to the site');
  }
});

test('measured points are deterministic and stay near the theoretical curve', () => {
  const again = MoonSeries.load('curvas');
  assert.deepEqual(again.map((s) => s.points), MoonSeries.all.map((s) => s.points));
  const linear = MoonSeries.all.find((s) => s.name === 'Linear').points;
  for (const [x, y] of linear) assert.ok(Math.abs(y - x) <= 0.4 + 1e-9, `x=${x} y=${y}`);
});

test('x is non-decreasing in every curve (Chart.js decimation needs sorted x)', () => {
  for (const s of MoonSeries.all) {
    for (let i = 1; i < s.points.length; i++) assert.ok(s.points[i][0] >= s.points[i - 1][0], `${s.name} at ${i}`);
  }
});

test('known curve values (measured within noise 0.4)', () => {
  const at = (name, x) => MoonSeries.all.find((s) => s.name === name).points.find((p) => near(p[0], x))[1];
  const close = (a, b) => Math.abs(a - b) <= 0.4 + 1e-9;
  assert.ok(close(at('Linear', 5), 5));
  assert.ok(close(at('Parabólica', 5), 10));
  assert.ok(close(at('Modular', 5), 0));
  assert.ok(close(at('Implícita', 5), 10));
  assert.ok(close(at('Senoidal', 0), 5));
  assert.ok(close(at('Cossenoidal', 0), 10));
  assert.ok(close(at('Quártica', 5), 10));
});

test('spurious datasets: two series, yearly x, normalized y, real value kept', () => {
  const spurious = MoonSeries.datasets.filter((d) => d.kind === 'spurious');
  assert.equal(spurious.length, 4);
  for (const d of spurious) {
    const series = MoonSeries.load(d.key);
    assert.equal(series.length, 2, d.key);
    for (const s of series) {
      const ys = s.points.map((p) => p[1]);
      assert.equal(Math.min(...ys), 0, `${d.key} ${s.name} min`);
      assert.equal(Math.max(...ys), 10, `${d.key} ${s.name} max`);
      assert.ok(s.points.every((p) => Number.isInteger(p[0]) && typeof p[2] === 'number'), `${d.key} ${s.name} points`);
    }
    // Same accuracy for both series in a given year: 100 × (1 − |A − B| / 10).
    series[0].points.forEach((p, i) => {
      const q = series[1].points[i];
      assert.equal(p[3], q[3]);
      assert.ok(Math.abs(p[3] - 100 * (1 - Math.abs(p[1] - q[1]) / 10)) <= 0.51, `${d.key} ${p[0]}`);
    });
  }
});

test('filterRows: null returns all rows, index returns one series, raw only for real data', () => {
  assert.equal(MoonSeries.filterRows(MoonSeries.all, null).length, 20 * 21);
  const rows = MoonSeries.filterRows(MoonSeries.all, 18);
  assert.equal(rows.length, 21);
  assert.ok(rows.every((r) => r.seriesIndex === 18 && r.name === 'Senoidal' && r.raw === null && r.accuracy >= 75));
  const sarah = MoonSeries.filterRows(MoonSeries.load('sarah'), 0);
  assert.equal(sarah[0].raw, 28004);
  assert.equal(sarah[0].x, 1987);
  assert.ok(sarah[0].accuracy >= 0 && sarah[0].accuracy <= 100);
});

test('core: notifies on change, ignores repeats and invalid indexes', () => {
  const core = createCore(6);
  const seen = [];
  core.onFilterChange((i) => seen.push(i));
  core.setFilter(2);
  core.setFilter(2);
  core.setFilter(99);
  core.setFilter(-1);
  core.setFilter(4);
  core.setFilter(null);
  assert.deepEqual(seen, [2, null, 4, null]);
  assert.equal(core.getFilter(), null);
});

// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MoonSeries = require('../site/shared/series.js');
const { createCore, createVLines, defaultVLines, fillRegions } = require('../site/shared/core.js');

const near = (a, b) => Math.abs(a - b) < 1e-3;

test('default dataset: 20 curves, 21 measured points, x and y within [0, 10], random accuracy 0–100', () => {
  assert.equal(MoonSeries.dataset.key, 'curvas');
  assert.equal(MoonSeries.all.length, 20);
  for (const s of MoonSeries.all) {
    assert.equal(s.points.length, 21, s.name);
    assert.ok(near(s.points[0][0], 0) && near(s.points.at(-1)[0], 10), `${s.name} x range`);
    for (const [x, y, raw, acc] of s.points) {
      assert.ok(x >= 0 && x <= 10 && y >= 0 && y <= 10, `${s.name} x=${x} y=${y}`);
      assert.equal(raw, null);
      assert.ok(Number.isInteger(acc) && acc >= 0 && acc <= 100, `${s.name} accuracy=${acc}`);
    }
    assert.match(s.color, /^#[0-9A-F]{6}$/, `${s.name} color must be hex (Chart.js dims it with alpha)`);
    assert.equal(s.formula, undefined, 'formula is not exposed to the site');
  }
});

test('same seed gives the same points; distance to the curve matches accuracy', () => {
  const again = MoonSeries.load('curvas');
  assert.deepEqual(again.map((s) => s.points), MoonSeries.all.map((s) => s.points));
  for (const s of MoonSeries.all) {
    // |measured − theoretical| = (1 − acc/100) · 2.5, up to rounding.
    for (const [, y, , acc, ref] of s.points) assert.ok(Math.abs(Math.abs(y - ref) - (1 - acc / 100) * 2.5) <= 0.02, `${s.name} y=${y} ref=${ref} acc=${acc}`);
  }
});

test('accuracy is spread out (random, not clustered)', () => {
  const accs = MoonSeries.all.flatMap((s) => s.points.map((p) => p[3]));
  assert.ok(Math.min(...accs) <= 20 && Math.max(...accs) >= 95, `range ${Math.min(...accs)}–${Math.max(...accs)}`);
  const low = accs.filter((a) => a < 50).length / accs.length;
  assert.ok(low > 0.2 && low < 0.7, `share below 50%: ${low}`);
});

test('x is non-decreasing in every curve (Chart.js decimation needs sorted x)', () => {
  for (const s of MoonSeries.all) {
    for (let i = 1; i < s.points.length; i++) assert.ok(s.points[i][0] >= s.points[i - 1][0], `${s.name} at ${i}`);
  }
});

test('known theoretical values (reference field)', () => {
  const ref = (name, x) => MoonSeries.all.find((s) => s.name === name).points.find((p) => near(p[0], x))[4];
  assert.equal(ref('Linear', 5), 5);
  assert.equal(ref('Parabólica', 5), 10);
  assert.equal(ref('Modular', 5), 0);
  assert.equal(ref('Implícita', 5), 10);
  assert.equal(ref('Senoidal', 0), 5);
  assert.equal(ref('Cossenoidal', 0), 10);
  assert.equal(ref('Quártica', 5), 10);
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
    for (const s of series) assert.ok(s.points.every((p) => Number.isInteger(p[3]) && p[3] >= 0 && p[3] <= 100), `${d.key} random accuracy`);
  }
});

test('filterRows: null returns all rows, index returns one series, raw only for real data', () => {
  assert.equal(MoonSeries.filterRows(MoonSeries.all, null).length, 20 * 21);
  const rows = MoonSeries.filterRows(MoonSeries.all, 18);
  assert.equal(rows.length, 21);
  assert.ok(rows.every((r) => r.seriesIndex === 18 && r.name === 'Senoidal' && r.raw === null && r.accuracy >= 0));
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

test('reference value per point and reference curve', () => {
  for (const s of MoonSeries.all) {
    assert.ok(s.reference.length > s.points.length, `${s.name} dense reference`);
    for (const p of s.points) assert.ok(Math.abs(p[1] - p[4]) <= 2.5 + 1e-3, `${s.name} measured within 2.5 of theoretical`);
  }
  for (const s of MoonSeries.load('malta')) {
    s.points.forEach((p, i) => {
      assert.deepEqual(s.reference[i], [p[0], p[4]], 'spurious reference = expected value per year');
      assert.ok(Math.abs(Math.abs(p[1] - p[4]) - (1 - p[3] / 100) * 2.5) <= 0.02, `${s.name} ${p[0]} distance matches accuracy`);
    });
  }
});

test('viz modes, accuracy colors and focus', () => {
  assert.deepEqual(MoonSeries.vizModes.map((m) => m.key), ['cor', 'faixa', 'rotulo']);
  assert.equal(MoonSeries.viz, 'faixa');
  assert.equal(MoonSeries.accuracyColor(100), '#3DDC84');
  assert.equal(MoonSeries.accuracyColor(0), '#FF6A3D');
  assert.equal(MoonSeries.accuracyColor(50), '#EAFE07');
  assert.match(MoonSeries.accuracyColor(90), /^#[0-9A-F]{6}$/);
  assert.deepEqual(MoonSeries.focus(3), [3]);
  assert.deepEqual(MoonSeries.focus(null), [], 'decorations only on the selected series');
  assert.deepEqual(MoonSeries.load('sarah').length, 2);
});

test('vertical lines: defaults, add in widest gap, remove, set with step and clamp, limit', () => {
  assert.deepEqual(defaultVLines(0, 10, 3), [2.5, 5, 7.5]);
  assert.equal(defaultVLines(0, 10, 20).length, 20, 'one per series');
  assert.deepEqual(defaultVLines(1987, 2022, 2).map(Math.round), [1999, 2010]);
  const vl = createVLines(0, 10, 0.01, defaultVLines(0, 10, 3), 4);
  const seen = [];
  vl.onChange((lines, src) => seen.push([lines.map((l) => l.value), src]));
  const id = vl.add(null, 'button');
  assert.equal(vl.list().find((l) => l.id === id).value, 1.25, 'widest gap is 0–2.5 (ties keep the first)');
  assert.equal(vl.add(null, 'button'), null, 'limit 4');
  vl.set(id, 99, 'drag');
  assert.equal(vl.list().find((l) => l.id === id).value, 10);
  vl.set(id, 'x', 'drag');
  vl.remove(id, 'button');
  vl.remove(999, 'button');
  assert.deepEqual(seen, [[[2.5, 5, 7.5, 1.25], 'button'], [[2.5, 5, 7.5, 10], 'drag'], [[2.5, 5, 7.5], 'button']]);
  const years = createVLines(1987, 2022, 1, ['1995.6', ''], 10);
  assert.deepEqual(years.list().map((l) => l.value), [1996], 'years round to whole numbers; empty ignored');
});

test('fillRegions: area above the horizontal line and right of the vertical line', () => {
  const tri = [[0, 0], [4, 8], [8, 0]]; // peak at (4, 8)
  // Above y=4, right of x=0: one polygon from crossing (2,4) over the peak to crossing (6,4).
  assert.deepEqual(fillRegions(tri, 4, 0), [[[2, 4], [4, 8], [6, 4]]]);
  // Vertical line at x=3 cuts it: starts at (3,4) up to the curve at (3,6).
  assert.deepEqual(fillRegions(tri, 4, 3), [[[3, 4], [3, 6], [4, 8], [6, 4]]]);
  // Line above the peak or vertical line past the end: nothing.
  assert.deepEqual(fillRegions(tri, 9, 0), []);
  assert.deepEqual(fillRegions(tri, 4, 9), []);
  // Two humps -> two polygons; ends above the line close at the last x.
  const w = [[0, 6], [2, 0], [4, 6]];
  assert.deepEqual(fillRegions(w, 3, 0), [[[0, 3], [0, 6], [1, 3]], [[3, 3], [4, 6], [4, 3]]]);
});

test('polygonArea: shoelace in data units', () => {
  const { polygonArea } = require('../site/shared/core.js');
  assert.equal(polygonArea([[2, 4], [4, 8], [6, 4]]), 8); // triangle base 4, height 4
  assert.equal(polygonArea([[0, 0], [0, 2], [3, 2], [3, 0]]), 6);
  const tri = [[0, 0], [4, 8], [8, 0]];
  const total = fillRegions(tri, 4, 3).reduce((s, p) => s + polygonArea(p), 0);
  assert.ok(Math.abs(total - 7) < 1e-9, `cut at x=3: ${total}`); // 8 minus the triangle (2,4)-(3,6)-(3,4) = 1
});

test('core visibility: legend toggles tracked per series', () => {
  const core = createCore(3);
  const seen = [];
  core.onVisibilityChange((i, v) => seen.push([i, v]));
  assert.equal(core.visibleCount(), 3);
  core.setVisible(1, false);
  core.setVisible(1, false);
  core.setVisible(9, false);
  assert.equal(core.isVisible(1), false);
  assert.equal(core.visibleCount(), 2);
  core.setVisible(1, true);
  assert.deepEqual(seen, [[1, false], [1, true]]);
});

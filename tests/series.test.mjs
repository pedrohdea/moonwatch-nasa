// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MoonSeries = require('../site/shared/series.js');
const { createCore } = require('../site/shared/core.js');

test('six series with 2001 points each, y within [0, 10]', () => {
  assert.equal(MoonSeries.all.length, 6);
  for (const s of MoonSeries.all) {
    assert.equal(s.points.length, 2001, s.name);
    assert.deepEqual(s.points[0][0], 0);
    assert.deepEqual(s.points.at(-1)[0], 10);
    for (const [, y] of s.points) assert.ok(y >= 0 && y <= 10, `${s.name} y=${y}`);
  }
});

test('known values', () => {
  const at = (i, x) => MoonSeries.all[i].points.find((p) => p[0] === x)[1];
  assert.equal(at(0, 5), 5);
  assert.equal(at(1, 10), 10);
  assert.equal(at(2, 10), 10);
  assert.equal(at(3, 10), 10);
  assert.equal(at(4, 10), 10);
  assert.equal(at(5, 0), 5);
});

test('filterRows: null returns all rows, index returns one series', () => {
  assert.equal(MoonSeries.filterRows(MoonSeries.all, null).length, 6 * 2001);
  const rows = MoonSeries.filterRows(MoonSeries.all, 5);
  assert.equal(rows.length, 2001);
  assert.ok(rows.every((r) => r.seriesIndex === 5 && r.name === 'Senoidal'));
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

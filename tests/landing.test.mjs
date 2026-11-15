// Pure math of the #sites globe (site/shared/landing.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const L = createRequire(import.meta.url)('../site/shared/landing.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('16 unique missions with Moon3DMap URLs matching the pasted links', () => {
  assert.equal(L.MISSIONS.length, 16);
  assert.equal(new Set(L.MISSIONS.map((m) => m.key)).size, 16);
  const a11 = L.MISSIONS.find((m) => m.key === 'apollo-11-landing-site');
  assert.equal(a11.url, 'https://moon3dmap.com/en/apollo-11-landing-site/?lat=0.7100&long=23.6300&layer=nasa-wac&auto3d=1');
  const luna2 = L.MISSIONS.find((m) => m.key === 'luna-2-impact-site');
  assert.equal(luna2.url, 'https://moon3dmap.com/en/luna-2-impact-site/?lat=29.1000&long=0.0000&layer=nasa-wac&auto3d=1');
});

test('shortest longitude turn crosses 180° when shorter', () => {
  close(L.shortestLon(177.59, -64.4), 295.6); // across the 180° meridian: +118°, not -242°
  close(L.shortestLon(10, 20), 20);
  close(L.shortestLon(-170, 170), -190);
});

test('interpolation starts at a, ends at b, zooms out on long hops', () => {
  const a = { lat: -45.46, lon: 177.59, zoom: 2.4 };
  const b = { lat: -7.1, lon: -64.4, zoom: 2.4 };
  const v0 = L.interpolateView(a, b, 0);
  const v1 = L.interpolateView(a, b, 1);
  close(v0.lat, a.lat); close(v0.lon, a.lon); close(v0.zoom, a.zoom);
  close(v1.lat, b.lat); close(v1.lon, b.lon); close(v1.zoom, b.zoom);
  const mid = L.interpolateView(a, b, 0.5);
  assert.ok(mid.zoom < 1.5);
  assert.ok(mid.lon > 177 || mid.lon < -64); // went through 180°, not across the near side
});

test('orthographic projection round-trips and keeps east on the right', () => {
  const view = { lat: 0.71, lon: 23.63 };
  for (const m of L.MISSIONS) {
    const s = L.latLonToScreen(m.lat, m.lon, view);
    if (!s.visible) continue;
    const p = L.screenToLatLon(s.x, s.y, view);
    close(p.lat, m.lat, 1e-9); close(p.lon, m.lon, 1e-9);
  }
  const center = L.screenToLatLon(0, 0, view);
  close(center.lat, 0.71); close(center.lon, 23.63);
  const crisium = L.latLonToScreen(17, 59, view);
  assert.ok(crisium.x > 0 && crisium.y > 0); // NE of Apollo 11: right and up
  assert.equal(L.latLonToScreen(-45.46, 177.59, view).visible, false); // far side
});

test('three.js rotation brings the site to the camera (+Z)', () => {
  for (const m of L.MISSIONS) {
    const [x, y, z] = L.surfacePoint(m.lat, m.lon);
    const r = L.globeRotation(m.lat, m.lon);
    // Euler XYZ: v' = Rx * Ry * v
    const x1 = x * Math.cos(r.y) + z * Math.sin(r.y), z1 = -x * Math.sin(r.y) + z * Math.cos(r.y);
    const y2 = y * Math.cos(r.x) - z1 * Math.sin(r.x), z2 = y * Math.sin(r.x) + z1 * Math.cos(r.x);
    close(x1, 0); close(y2, 0); close(z2, 1);
  }
});

test('fictional sites CSV: 50 rows, 10 groups of 5; autoscale frames every selected point', () => {
  const rows = L.parseSites(readFileSync(new URL('../site/shared/data/dLandingSites.csv', import.meta.url), 'utf8'));
  assert.equal(rows.length, 50);
  const groups = L.groupSites(rows);
  assert.equal(groups.length, 10);
  for (const g of groups) assert.equal(g.points.length, 5);
  // every subset: all points inside 80% of the half view (orthographic, globe radius 0.46 of the canvas)
  for (const pick of [[0], [9], [0, 1], [3, 5, 7], groups.map((_, i) => i)]) {
    const pts = pick.flatMap((i) => groups[i].points);
    const f = L.frameSites(pts);
    assert.ok(f.zoom >= 1 && f.zoom <= 6, `zoom ${f.zoom}`);
    for (const p of pts) {
      const s = L.latLonToScreen(p.lat, p.lon, f);
      if (f.zoom > 1) assert.ok(s.visible && Math.hypot(s.x, s.y) * 0.46 * f.zoom <= 0.4 + 1e-9, `${p.name} off-frame`);
    }
  }
  const pole = L.frameSites(groups[9].points);
  assert.ok(pole.lat < -89.4); // south-pole cluster: vector mean, not a plain lat/lon average
  assert.equal(L.frameSites(groups[0].points).zoom, 6); // tight cluster: capped, not 100x+
  assert.deepEqual(L.parseSites('ID,NAME,LAT,LONG,missionID\n1,x,95,0,1\n2,y,abc,0,1\n3,z,1,2,1'), [
    { id: 3, name: 'z', lat: 1, lon: 2, group: 1, prsId: NaN, nearestCold: NaN }]);
});

test('Moon Trek tiles: 16x8 grid of 256 px covering the 4096x2048 mosaic, row-major', () => {
  const index = { zoom: 3, cols: 16, rows: 8, tile: 256 };
  const tiles = L.trekTiles(index, 'trek/');
  assert.equal(tiles.length, 128);
  assert.deepEqual(tiles[0], { url: 'trek/3/0/0.jpg', x: 0, y: 0 });
  assert.deepEqual(tiles[17], { url: 'trek/3/1/1.jpg', x: 256, y: 256 });
  assert.deepEqual(tiles[127], { url: 'trek/3/7/15.jpg', x: 3840, y: 1792 });
  const vendored = JSON.parse(readFileSync(new URL('../site/shared/vendor/nasa/moontrek/index.json', import.meta.url)));
  assert.equal(vendored.cols * vendored.tile, vendored.width);
  assert.equal(vendored.rows * vendored.tile, vendored.height);
});

test('Terrain 3D: STL only for Apollo 11, 12, 14, 15, 16', () => {
  assert.deepEqual(L.terrainModel('apollo-15-landing-site'), { apollo: 15, stl: 'shared/vendor/nasa/terrain/apollo-15.stl' });
  const withTerrain = L.MISSIONS.filter((m) => L.terrainModel(m.key)).map((m) => m.name);
  assert.deepEqual(withTerrain, ['Apollo 11', 'Apollo 12', 'Apollo 14', 'Apollo 15', 'Apollo 16']);
  assert.equal(L.terrainModel('apollo-17-landing-site'), null);
  assert.equal(L.terrainModel(null), null);
});

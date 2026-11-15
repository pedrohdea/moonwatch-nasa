// Run: node --test   (builds the DB into a temp file and checks the load and the join)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDb } from '../scripts/build-db.mjs';

test('build-db: loads both CSVs, keys hold, view joins every fact to its site', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moonwatch-db-'));
  const file = join(dir, 'moonwatch.sqlite');
  try {
    const s = buildDb(file);
    assert.deepEqual(s, { sites: 50, missions: 10, facts: 36550, from: '2024-01-01', to: '2025-12-31' });

    const db = new DatabaseSync(file);
    db.exec('PRAGMA foreign_keys = ON');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM v_viability').get().n, 36550, 'no fact lost in the join');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM f_viability GROUP BY landing_site_id LIMIT 1').get().n, 731, '731 days per site');
    const first = db.prepare("SELECT name, mission_id, viability FROM v_viability WHERE landing_site_id = 1 AND date = '2024-01-01'").get();
    assert.deepEqual({ ...first }, { name: 'quiet-horizon-402', mission_id: 1, viability: 101 });
    assert.throws(() => db.prepare("INSERT INTO f_viability VALUES (999, '2024-01-01', 1)").run(), /FOREIGN KEY/, 'unknown site rejected');
    assert.throws(() => db.prepare("INSERT INTO f_viability VALUES (1, '2024-01-01', 1)").run(), /UNIQUE|PRIMARY/, 'duplicate (site, date) rejected');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

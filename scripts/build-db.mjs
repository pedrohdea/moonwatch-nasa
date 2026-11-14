// Builds a SQLite star schema from the two landing-site CSVs (Node 22 built-in node:sqlite, no dependencies):
//   d_landing_sites  <- site/shared/data/dLandingSites.csv        (ID,NAME,LAT,LONG,missionID,PRSID,NEARESTCOLD)
//   f_viability      <- docs/fLandingSites_viability.csv           (LANDINGSITEID,DATE,VIABILITY)
//   v_viability      =  f_viability JOIN d_landing_sites on landing_site_id = id
// Usage: node scripts/build-db.mjs [--out data/moonwatch.sqlite]
// The output file is rebuilt from scratch on every run (it is a derived artifact, git-ignored).
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITES_CSV = resolve(ROOT, 'site/shared/data/dLandingSites.csv');
const VIABILITY_CSV = resolve(ROOT, 'docs/fLandingSites_viability.csv');

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE d_landing_sites (
  id            INTEGER PRIMARY KEY,           -- LANDINGSITEID in the fact table
  name          TEXT    NOT NULL UNIQUE,
  lat           REAL    NOT NULL CHECK (lat  BETWEEN -90  AND 90),
  long          REAL    NOT NULL CHECK (long BETWEEN -180 AND 360),
  mission_id    INTEGER NOT NULL,
  prs_id        INTEGER NOT NULL,
  nearest_cold  REAL    NOT NULL CHECK (nearest_cold >= 0)
);

CREATE TABLE f_viability (
  landing_site_id INTEGER NOT NULL REFERENCES d_landing_sites (id),
  date            TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  viability       REAL    NOT NULL,
  PRIMARY KEY (landing_site_id, date)
) WITHOUT ROWID;

CREATE INDEX ix_f_viability_date ON f_viability (date);
CREATE INDEX ix_d_landing_sites_mission ON d_landing_sites (mission_id);

CREATE VIEW v_viability AS
SELECT f.landing_site_id, s.name, s.mission_id, s.lat, s.long, s.prs_id, s.nearest_cold, f.date, f.viability
FROM f_viability f
JOIN d_landing_sites s ON s.id = f.landing_site_id;
`;

// Plain CSV (no quoted fields in these files); fails loudly on anything unexpected.
function readCsv(path, expectedHeader) {
  const lines = readFileSync(path, 'utf-8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0].split(',').map((h) => h.trim());
  if (header.join(',') !== expectedHeader.join(',')) {
    throw new Error(`${path}: cabeçalho inesperado "${header.join(',')}", esperado "${expectedHeader.join(',')}"`);
  }
  return lines.slice(1).map((line, i) => {
    if (line.includes('"')) throw new Error(`${path}:${i + 2}: campos com aspas não são suportados`);
    const cells = line.split(',').map((c) => c.trim());
    if (cells.length !== header.length) throw new Error(`${path}:${i + 2}: ${cells.length} colunas, esperado ${header.length}`);
    return { line: i + 2, cells };
  });
}

function num(path, row, value, integer) {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n) || (integer && !Number.isInteger(n))) {
    throw new Error(`${path}:${row.line}: valor numérico inválido "${value}"`);
  }
  return n;
}

export function buildDb(out) {
  if (existsSync(out)) rmSync(out);
  mkdirSync(dirname(out), { recursive: true });
  const db = new DatabaseSync(out);
  db.exec(SCHEMA);

  const sites = readCsv(SITES_CSV, ['ID', 'NAME', 'LAT', 'LONG', 'missionID', 'PRSID', 'NEARESTCOLD']);
  const facts = readCsv(VIABILITY_CSV, ['LANDINGSITEID', 'DATE', 'VIABILITY']);

  const insertSite = db.prepare('INSERT INTO d_landing_sites VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertFact = db.prepare('INSERT INTO f_viability VALUES (?, ?, ?)');

  // One transaction: either the whole load succeeds or the file is left without partial data.
  db.exec('BEGIN');
  try {
    for (const r of sites) {
      const [id, name, lat, long, mission, prs, cold] = r.cells;
      insertSite.run(num(SITES_CSV, r, id, true), name, num(SITES_CSV, r, lat), num(SITES_CSV, r, long),
        num(SITES_CSV, r, mission, true), num(SITES_CSV, r, prs, true), num(SITES_CSV, r, cold));
    }
    for (const r of facts) {
      const [site, date, viability] = r.cells;
      insertFact.run(num(VIABILITY_CSV, r, site, true), date, num(VIABILITY_CSV, r, viability));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    db.close();
    rmSync(out, { force: true });
    throw err;
  }

  const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
  if (fkErrors.length) throw new Error(`chaves estrangeiras inválidas: ${JSON.stringify(fkErrors.slice(0, 5))}`);
  const summary = {
    sites: db.prepare('SELECT COUNT(*) n FROM d_landing_sites').get().n,
    missions: db.prepare('SELECT COUNT(DISTINCT mission_id) n FROM d_landing_sites').get().n,
    facts: db.prepare('SELECT COUNT(*) n FROM f_viability').get().n,
    from: db.prepare('SELECT MIN(date) d FROM f_viability').get().d,
    to: db.prepare('SELECT MAX(date) d FROM f_viability').get().d
  };
  db.close();
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const out = resolve(ROOT, i > 0 ? process.argv[i + 1] : 'data/moonwatch.sqlite');
  const s = buildDb(out);
  console.log(`${out}: ${s.sites} sítios em ${s.missions} missões, ${s.facts} linhas de viabilidade (${s.from} a ${s.to})`);
}

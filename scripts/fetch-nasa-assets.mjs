// Downloads the NASA 3D assets used by the "Landing & Impact Sites" section into site/shared/vendor/ (versioned):
//   nasa/moon_small.glb                  NASA SVS 14959 — Moon 3D model (LRO color + topography)
//   nasa/apollo-lm.glb                   NASA 3D Resources (GitHub) — Apollo Lunar Module
//   nasa/terrain/apollo-NN.stl           NASA 3D Resources — Apollo 11/12/14/15/16 landing-site height maps
//   nasa/moontrek/<z>/<row>/<col>.jpg    NASA Moon Trek WMTS — LRO WAC global mosaic (one zoom level) + index.json
//   three/...                            three.js r158 ES modules + GLTFLoader / STLLoader (MIT)
// Usage: node scripts/fetch-nasa-assets.mjs [--zoom 3]     (re-running overwrites the files)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = resolve(ROOT, 'site/shared/vendor');
const zi = process.argv.indexOf('--zoom');
const ZOOM = zi > 0 ? Number(process.argv[zi + 1]) : 3;

const SVS_GLB = 'https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/moon_small.glb';
const LM_GLB = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Apollo%20Lunar%20Module/Apollo%20Lunar%20Module.glb';
const STL = (n) => `https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/printable/apollo-${n}---landing-site/Apollo%20${n}%20-%20Landing%20Site.stl`;
const APOLLO = [11, 12, 14, 15, 16];
const TREK = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm';
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.158.0';
const THREE_FILES = {
  'three/three.module.min.js': `${THREE}/build/three.module.min.js`,
  'three/addons/loaders/GLTFLoader.js': `${THREE}/examples/jsm/loaders/GLTFLoader.js`,
  'three/addons/loaders/STLLoader.js': `${THREE}/examples/jsm/loaders/STLLoader.js`,
  'three/addons/utils/BufferGeometryUtils.js': `${THREE}/examples/jsm/utils/BufferGeometryUtils.js`
};

async function download(url, rel, minBytes = 1000) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) throw new Error(`${url}: only ${buf.length} bytes`);
  const out = resolve(VENDOR, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  return buf.length;
}

// Small worker pool so the tile server is not hammered.
async function pool(jobs, size) {
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < jobs.length) await jobs[next++]();
  }));
}

const log = [];
const add = async (url, rel, min) => { const n = await download(url, rel, min); log.push([rel, n, url]); console.log(`${rel}  ${(n / 1e6).toFixed(2)} MB`); };

await add(SVS_GLB, 'nasa/moon_small.glb', 1e6);
await add(LM_GLB, 'nasa/apollo-lm.glb', 1e5);
for (const n of APOLLO) await add(STL(n), `nasa/terrain/apollo-${n}.stl`, 1e6);
for (const [rel, url] of Object.entries(THREE_FILES)) await add(url, rel, 1000);

const cols = 2 * 2 ** ZOOM;
const rows = 2 ** ZOOM;
const jobs = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  jobs.push(() => download(`${TREK}/${ZOOM}/${r}/${c}.jpg`, `nasa/moontrek/${ZOOM}/${r}/${c}.jpg`, 100));
}
await pool(jobs, 6);
writeFileSync(resolve(VENDOR, 'nasa/moontrek/index.json'), JSON.stringify({
  layer: 'LRO_WAC_Mosaic_Global_303ppd_v02', zoom: ZOOM, cols, rows, tile: 256,
  width: cols * 256, height: rows * 256, projection: 'equirectangular, top-left -180,90',
  source: `${TREK}/{z}/{row}/{col}.jpg`, fetched: new Date().toISOString().slice(0, 10)
}, null, 2) + '\n');
console.log(`nasa/moontrek/${ZOOM}: ${cols}x${rows} tiles (${cols * 256}x${rows * 256} px)`);

writeFileSync(resolve(VENDOR, 'nasa/SOURCES.md'), `# NASA assets (downloaded by scripts/fetch-nasa-assets.mjs)

NASA imagery and 3D models are generally not copyrighted (NASA media usage guidelines); credit NASA.

| File | Source |
|---|---|
${log.filter(([rel]) => rel.startsWith('nasa/')).map(([rel, n, url]) => `| \`${rel.slice(5)}\` (${(n / 1e6).toFixed(2)} MB) | ${url} |`).join('\n')}
| \`moontrek/${ZOOM}/<row>/<col>.jpg\` (${cols * rows} tiles) | NASA Moon Trek WMTS, LRO WAC global mosaic: ${TREK}/{z}/{row}/{col}.jpg |

- moon_small.glb: NASA Scientific Visualization Studio, "Moon 3D Models for Web, AR, and Animation" (https://svs.gsfc.nasa.gov/14959/).
- Apollo landing sites: NASA 3D Resources (https://science.nasa.gov/3d-resources/), 30x30 km height maps, Z exaggerated 60x.
- Apollo Lunar Module: NASA 3D Resources on GitHub (https://github.com/nasa/NASA-3D-Resources).
- three.js r158 (MIT) in ../three/.
`);
console.log('done');

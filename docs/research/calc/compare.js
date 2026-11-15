// Compare our mask-based sunlit%/Earth-visible% vs PGDA (Mazarico) 18.6-yr average maps.
const fs = require('fs');
const { sunEarthAzEl } = require('./moonAzEl.js');
const P = JSON.parse(fs.readFileSync('pgda_points.json'));
function stats(lat, lon, H, t0, t1, stepH) {
  const m = (az) => { const i = Math.floor(az), f = az - i; return H[i % 360] * (1 - f) + H[(i + 1) % 360] * f; };
  let sc = 0, sd = 0, e = 0, n = 0;
  for (let t = t0; t < t1; t += stepH * 3600e3) {
    const r = sunEarthAzEl(lat, lon, new Date(t));
    const ds = r.sun.el - m(r.sun.az);
    sc += ds > 0; sd += Math.min(1, Math.max(0, ds / 0.533 + 0.5)); // shortcut: linear disk fraction
    e += r.earth.el > m(r.earth.az); n++;
  }
  return { sunCenter: 100 * sc / n, sunDisk: 100 * sd / n, earth: 100 * e / n };
}
const rows = [];
for (const [k, p] of Object.entries(P)) {
  const f = `dem/v_${k}.json`; if (!fs.existsSync(f)) continue;
  const H = JSON.parse(fs.readFileSync(f)).horizon_el_deg;
  const y27 = stats(p.lat, p.lon, H, Date.UTC(2027, 0, 1), Date.UTC(2028, 0, 1), 1);
  const cyc = stats(p.lat, p.lon, H, Date.UTC(2009, 6, 1), Date.UTC(2028, 1, 1), 3); // ~18.6 yr
  const f1 = (x) => +x.toFixed(1);
  rows.push({ pt: k, lat: p.lat, lon: p.lon, pgdaSun: p.sun, pgda3x3: p.sun_3x3.join('..'), our2027: f1(y27.sunCenter),
    ourCycleCenter: f1(cyc.sunCenter), ourCycleDisk: f1(cyc.sunDisk), dSun: f1(cyc.sunDisk - p.sun),
    pgdaEarth: p.earth, ourCycleEarth: f1(cyc.earth), dEarth: f1(cyc.earth - p.earth) });
}
console.table(rows); fs.writeFileSync('compare.json', JSON.stringify(rows, null, 1));

const fs = require('fs');
const { sunEarthAzEl } = require('./moonAzEl.js');
const SITES = { equator: [0, 0], connecting_ridge: [-89.45, -137.0], mons_mouton: [-84.6, 31.0] };
const BODIES = { sun: '10', earth: '399' };
async function horizons(body, lat, lon) {
  const f = `horizons_${body}_${lat}_${lon}.txt`;
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const p = new URLSearchParams({ format: 'text', COMMAND: `'${BODIES[body]}'`, CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${(lon + 360) % 360},${lat},0'`, EPHEM_TYPE: "'OBSERVER'", START_TIME: "'2027-01-01'", STOP_TIME: "'2027-02-01'",
    STEP_SIZE: "'1h'", QUANTITIES: "'4'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'", EXTRA_PREC: "'YES'" });
  const txt = await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p)).text();
  fs.writeFileSync(f, txt); return txt;
}
const MON = { Jan: 0, Feb: 1 };
function parse(txt) {
  const body = txt.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
  return body.map((l) => { const c = l.split(',').map((s) => s.trim());
    const [d, hm] = c[0].split(' '); const [Y, M, D] = d.split('-'); const [h, m] = hm.split(':');
    return { t: new Date(Date.UTC(+Y, MON[M], +D, +h, +m)), az: +c[3], el: +c[4] }; });
}
const angDiff = (a, b) => { const d = ((a - b + 540) % 360) - 180; return Math.abs(d); };
(async () => {
  const out = [];
  for (const [name, [lat, lon]] of Object.entries(SITES)) for (const body of Object.keys(BODIES)) {
    const rows = parse(await horizons(body, lat, lon));
    let maxEl = 0, maxAz = 0, maxSep = 0, elMin = 99, elMax = -99;
    for (const r of rows) {
      const m = sunEarthAzEl(lat, lon, r.t)[body];
      maxEl = Math.max(maxEl, Math.abs(m.el - r.el)); maxAz = Math.max(maxAz, angDiff(m.az, r.az));
      // great-circle separation (az error shrinks near zenith)
      const v = (az, el) => [Math.cos(el * Math.PI / 180) * Math.sin(az * Math.PI / 180), Math.cos(el * Math.PI / 180) * Math.cos(az * Math.PI / 180), Math.sin(el * Math.PI / 180)];
      const a = v(m.az, m.el), b = v(r.az, r.el); maxSep = Math.max(maxSep, Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180 / Math.PI);
      elMin = Math.min(elMin, r.el); elMax = Math.max(elMax, r.el);
    }
    out.push({ site: name, lat, lon, body, n: rows.length, maxErrEl: +maxEl.toFixed(4), maxErrAz: +maxAz.toFixed(4), maxSep: +maxSep.toFixed(4), horizonsElRange: [elMin, elMax] });
  }
  console.table(out); fs.writeFileSync('errors.json', JSON.stringify(out, null, 1));
})();

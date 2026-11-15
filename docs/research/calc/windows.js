// Jan 2027 hourly: % of time Sun (center) and Earth above terrain horizon mask.
const fs = require('fs');
const { sunEarthAzEl } = require('./moonAzEl.js');
for (const [name, lat, lon] of [['im2_mons_mouton', -84.7906, 29.1957], ['connecting_ridge', -89.45, -137], ['mons_mouton', -84.6, 31]]) {
  const f = `dem/horizon_${name}.json`; if (!fs.existsSync(f)) continue;
  const H = JSON.parse(fs.readFileSync(f)).horizon_el_deg;
  const mask = (az) => H[Math.floor(az) % 360];
  let sun = 0, earth = 0, both = 0, sunFlat = 0, n = 0;
  for (let h = 0; h < 744; h++) {
    const r = sunEarthAzEl(lat, lon, new Date(Date.UTC(2027, 0, 1, h)));
    const s = r.sun.el > mask(r.sun.az), e = r.earth.el > mask(r.earth.az);
    sun += s; earth += e; both += s && e; sunFlat += r.sun.el > 0; n++;
  }
  const p = (x) => (100 * x / n).toFixed(1) + '%';
  console.log(name, { sunLit: p(sun), sunLitFlatHorizon: p(sunFlat), earthVisible: p(earth), both: p(both) });
}

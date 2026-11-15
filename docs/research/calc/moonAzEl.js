// Topocentric Sun/Earth az/el for a site on the Moon, using astronomy-engine.
// Frame: IAU/WGCCRE Moon rotation model (RotationAxis(Body.Moon)) ~ Mean-Earth/polar-axis (ME).
// Azimuth: degrees from local north, clockwise (east = 90), same as JPL Horizons.
const A = require('astronomy-engine');
const R_MOON_KM = 1737.4;
const C_AU_PER_DAY = 173.1446326846693;
const D2R = Math.PI / 180;

// J2000 (EQJ) -> Moon body-fixed rotation: Rz(W) * Rx(90-dec) * Rz(90+ra)
function eqjToMoonFixed(time) {
  const ax = A.RotationAxis(A.Body.Moon, time);
  const a = (90 + ax.ra * 15) * D2R /* ax.ra is in sidereal HOURS */, b = (90 - ax.dec) * D2R, w = ax.spin * D2R;
  const rz = (t) => [[Math.cos(t), Math.sin(t), 0], [-Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
  const rx = (t) => [[1, 0, 0], [0, Math.cos(t), Math.sin(t)], [0, -Math.sin(t), Math.cos(t)]];
  const mul = (P, Q) => P.map((r) => [0, 1, 2].map((j) => r[0] * Q[0][j] + r[1] * Q[1][j] + r[2] * Q[2][j]));
  return mul(rz(w), mul(rx(b), rz(a)));
}
const apply = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

function azEl(vFixed, latDeg, lonDeg, siteKm) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const v = [0, 1, 2].map((i) => vFixed[i] - siteKm[i]);
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const u = dot(v, up), e = dot(v, east), n = dot(v, north);
  const az = (Math.atan2(e, n) / D2R + 360) % 360;
  const el = Math.atan2(u, Math.hypot(e, n)) / D2R;
  return { az, el };
}

function sunEarthAzEl(latDeg, lonDeg, dateUTC) {
  const t = A.MakeTime(dateUTC);
  const M = eqjToMoonFixed(t);
  const AU_KM = A.KM_PER_AU;
  const la = latDeg * D2R, lo = lonDeg * D2R;
  const site = [R_MOON_KM * Math.cos(la) * Math.cos(lo), R_MOON_KM * Math.cos(la) * Math.sin(lo), R_MOON_KM * Math.sin(la)];
  // Earth: -GeoMoon (light-time 1.3 s, negligible)
  const gm = A.GeoMoon(t);
  const earth = apply(M, [-gm.x * AU_KM, -gm.y * AU_KM, -gm.z * AU_KM]);
  // Sun: -HelioVector(Moon) + stellar aberration from Moon's heliocentric velocity (~20")
  const st = A.HelioState(A.Body.Moon, t);
  const dist = Math.hypot(st.x, st.y, st.z);
  const k = dist / C_AU_PER_DAY; // light-time days, times velocity => aberration shift
  const sunEqj = [-st.x + st.vx * k, -st.y + st.vy * k, -st.z + st.vz * k].map((x) => x * AU_KM);
  const sun = apply(M, sunEqj);
  return { sun: azEl(sun, latDeg, lonDeg, site), earth: azEl(earth, latDeg, lonDeg, site) };
}
module.exports = { sunEarthAzEl };

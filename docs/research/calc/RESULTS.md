# Sun/Earth az/el on the lunar surface — research + validation

Date: 2026-11-14. Files in this directory:
- `moonAzEl.js` — prototype `sunEarthAzEl(lat, lon, date)` (astronomy-engine 2.1.19)
- `validate.js` — compares with JPL Horizons (cache in `horizons_*.txt`), output `errors.json`
- `horizon.py` — horizon mask (360 bins) from the LOLA COG DEM (reads only the window via HTTP range)
- `dem/horizon_*.json` — computed horizon profiles
- `windows.js` — % of time with Sun / Earth above the terrain horizon (Jan/2027)

## Recommendation

**astronomy-engine** (npm `astronomy-engine`, cosinekitty, MIT, no dependencies).
- `astronomy.browser.min.js` = 113.7 KB (46.7 KB gzip). Works offline, a single `<script>`, global `Astronomy`.
- Tem `RotationAxis(Body.Moon, t)` = IAU/WGCCRE model (pole ra, dec + prime meridian angle W, with the
  physical libration terms E1..E13). With it, the Moon-fixed frame is built (≈ Mean-Earth/polar-axis, ME).
- It also has `Libration(t)` (geocentric optical libration — **not** suitable for the fixed frame; use `RotationAxis`).
- Performance: ~0.045 ms/point (2160 points in 96 ms in Node) → 1 hourly year ≈ 0.4 s.

Discarded:
- **timecraftjs** (SPICE/CSPICE in WASM): maximum precision, but WASM ~ MBs + kernels (de440 ~100 MB+, or
  SPK subset ~MB, `moon_pa_de440` PCK, FK/LSK). Overkill; extra precision is irrelevant given the DEM error.
- **Custom implementation** (IAU 2015 + Meeus): it is exactly what astronomy-engine already does, with
  truncated VSOP87/ELP ephemerides better than low-precision Meeus. Do not reinvent.

## Frame / conventions
- Fixed frame: IAU/WGCCRE Moon (approximation of **MOON_ME**; Horizons uses `MEAN_ME (high precision)` from DE441).
  Difference measured vs Horizons MEAN_ME: ≤0.0033° (table below). PA vs ME differs ~0.03° (~875 m): the LOLA/PGDA
  DEMs are in **MOON_ME** — use ME lat/lon (consistent with this code).
- Selenocentric lat/lon, **east-positive** longitude (−137 = 137°W = 223°E). Sphere R = 1737.4 km.
- Azimuth: degrees from local north, clockwise (east = 90°), same as Horizons.
  At the south pole "north" = the direction pointing away from the pole.
- Geometric elevation + stellar aberration for the Sun (~20"); no refraction (no atmosphere).

## Code (core)
```js
const A = Astronomy; // ou require('astronomy-engine')
function eqjToMoonFixed(t) {           // Rz(W)·Rx(90°−dec)·Rz(90°+ra)
  const ax = A.RotationAxis(A.Body.Moon, t);
  const a = (90 + ax.ra * 15) * D2R;   // GOTCHA: ax.ra is in sidereal HOURS
  const b = (90 - ax.dec) * D2R, w = ax.spin * D2R;
  return mul(rz(w), mul(rx(b), rz(a)));
}
// Earth: -GeoMoon(t)  (EQJ, AU)  ;  Sun: -HelioVector(Moon) + v_moon·(dist/c)  (aberration)
// v_fixed = M · v_EQJ ; subtract the site vector (R·up) ; project onto (east, north, up) → az/el
```
Full file: `moonAzEl.js` (~50 lines).

## Validation vs JPL Horizons (Jan/2027, hourly, 745 points per row)
Query: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='Elon,lat,0'`, `QUANTITIES='4'`,
`ANG_FORMAT='DEG'`, `CSV_FORMAT='YES'`, `EXTRA_PREC='YES'` at https://ssd.jpl.nasa.gov/api/horizons.api

| Site | lat, lon (E+) | Body | max |Δel| ° | max |Δaz| ° | max separation ° | Horizons el range ° |
|---|---|---|---|---|---|---|
| Equator | 0, 0 | Sun | 0.0030 | 0.100* | 0.0033 | −89.1 … 89.5 |
| Equator | 0, 0 | Earth | 0.0018 | 0.023* | 0.0025 | 80.0 … 87.4 |
| Connecting Ridge (approx.) | −89.45, −137 | Sun | 0.0021 | 0.0030 | 0.0033 | 0.05 … 1.52 |
| Connecting Ridge (approx.) | −89.45, −137 | Earth | 0.0019 | 0.0025 | 0.0025 | −7.54 … 6.15 |
| Mons Mouton (approx.) | −84.6, 31 | Sun | 0.0019 | 0.0031 | 0.0033 | −4.45 … 5.99 |
| Mons Mouton (approx.) | −84.6, 31 | Earth | 0.0020 | 0.0025 | 0.0025 | −2.19 … 10.77 |

\* Large azimuth error only near the zenith (az poorly defined); real angular separation ≤ 0.0033°.

**Maximum error ≤ 0.0035° (~12″)** — 1/80 of the Sun's diameter (0.53°). Far below the DEM error.

Sanity checks:
- Earth at the south pole oscillates ~±7° (−7.5…+6.2 at −89.45°); ascending crossings of 0° every 27.21 and 27.29 d (draconic month 27.21 d). OK.
- Sun at −89.45° between 0.05° and 1.5° (Jan = lunar austral summer). OK.
- (0,0): Earth between 80° and 87.4° elevation (libration). OK.

## Horizon / terrain
Fonte: PGDA "A New View of the Lunar South Pole from LOLA" https://pgda.gsfc.nasa.gov/products/90
(Barker et al.) — all **COG GeoTIFF**, south polar stereographic, MOON_ME, sphere 1737.4 km, float32 heights (m).
- `LDEM_80S_80MPP_ADJ.TIF` 181 MB (80–90°S, 7600², 512 blocks, overviews 2/4/8/16)
- `LDEM_80S_40MPP_ADJ.TIF` 685 MB, `LDEM_80S_20MPP_ADJ.TIF` 2.6 GB, `LDEM_83S_10MPP_ADJ.TIF` 4.8 GB
- 5 m/px per site (Artemis candidates): https://pgda.gsfc.nasa.gov/products/78 (`Site01..` `_final_adj_5mpp_surf.tif`)
- There is no ready-made horizon product in PGDA (only hillshade). Researchers (Mazarico et al. 2011) compute the
  horizon from the DEM — same idea below.

Offline approach (done): `horizon.py` reads via `/vsicurl/` (GDAL range requests) **only the window** of ±150 km
around the site (without downloading the whole file), converts each pixel to 3D (sphere + height), computes
az/el from the site (+2 m mast) and keeps the **maximum per 1° bin** → JSON with 360 numbers.
Curvature is implicitly included by the 3D geometry.

Result (80 m/px, 150 km radius):
- Connecting Ridge approx. (−89.45, −137): height 1957 m, horizon −3.73 … −0.13° (mean −1.91) → ridge: horizon below the plane.
- Mons Mouton IAU center (−84.6, 31): height 5049 m, horizon +0.43 … +8.26° (mean 3.63) → point is NOT the summit
  (Mons Mouton ~6 km); it is on the slope. Coordinate must be corrected (IAU Gazetteer).
- **IM-2 Athena (actual landing, verified, Wikipedia): (−84.7906, 29.1957)**: height 5321 m, horizon −1.64 … +4.07° (mean 1.08).
- Time: ~2 min per site (range download; estimate ≤ ~55 MB per window = 3750² float32 before compression; whole 181 MB file not downloaded).
- Summit in the DEM (overview 1.28 km/px): max 6975 m at (−84.66, 39.2) within a 40 km radius of (−84.6, 31).

Jan/2027 windows (hourly, Sun center vs mask) — `windows.js`:

| Site | Sun (with terrain) | Sun (flat horizon) | Earth visible | Both |
|---|---|---|---|---|
| Connecting Ridge approx. | 100.0% | 100.0% | 45.2% | 45.2% |
| Mons Mouton IAU center (−84.6, 31) | 39.1% | 51.1% | 48.7% | 31.3% |
| IM-2 Athena (−84.7906, 29.1957) | 45.4% | 51.2% | 69.4% | 43.1% |

Terrain changes the result by 12 p.p. at Mons Mouton → mask is mandatory.

Embedded data size: 360 floats with 2 decimals ≈ 2.6 KB JSON (~1 KB gzip) per site. 100 sites ≈ 260 KB.
A candidate grid (e.g. 50×50 points) = 2500 × 2.6 KB ≈ 6.5 MB (or ~1.8 MB as binary Int16 hundredths of a degree).

Use in the browser: `visible = el > horizon[floor(az)]` (optional: interpolate and consider half the solar disc, 0.27°,
for the illuminated disc fraction).

Limitations: 80 m/px underestimates the near horizon (<1–2 km); for the final site use 20 m (near) + 80 m (far)
or 5 m PGDA products/78. 150 km radius: beyond that the curvature drop d²/2R ≥ 6.5 km, only huge mountains count.
Coordinates: Mons Mouton center 84.6°S 31.0°E (Wikipedia/IAU) and IM-2 verified; Connecting Ridge (−89.45, −137) approximate, but confirmed as a high ridge point in the DEM.

## Gotchas
1. `RotationAxis().ra` in **hours** (×15), `dec` in degrees, `spin` in degrees (not normalized).
2. Use `RotationAxis(Body.Moon)` (fixed frame), not `Libration()` (optical geocentric libration, for visualizing the Earth).
3. Time: UTC input (`Date`); astronomy-engine converts UT→TT internally via ΔT (Espenak/Meeus model). Horizons
   also uses UTC in the table. ΔT uncertain in the future (~1 s) → irrelevant (the Moon rotates 0.00015°/s).
4. Light-time: Earth 1.3 s (ignored); Sun ~8.3 min — `HelioVector(Moon)` vector + aberration (~20″) is enough;
   Horizons "apparent" also includes relativistic deflection (negligible).
5. Frames: PGDA DEM and Horizons use **MOON_ME**; SPICE "MOON_PA" data differs by ~0.03° (~875 m).
6. Longitude: Horizons SITE_COORD = E-lon 0..360, `lon,lat,alt` (reversed order!).
7. Azimuth at the pole: defined by the local meridian; near −90° it changes quickly with lon — use the exact lat/lon.
8. The Sun is a 0.53° disc: "sunrise" = upper limb; Sun elevation ~±1.5° at the pole → a 0.1° mask matters.

Note: ephemeris error does not depend on the site (same max separation at the 3 sites) → IM-2 not re-validated against Horizons.

## URLs
- astronomy-engine: https://www.npmjs.com/package/astronomy-engine — https://github.com/cosinekitty/astronomy
- WGCCRE 2015: https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf
- Horizons API: https://ssd.jpl.nasa.gov/api/horizons.api (doc https://ssd-api.jpl.nasa.gov/doc/horizons.html)
- PGDA DEMs: https://pgda.gsfc.nasa.gov/products/90 — 5 m sites: https://pgda.gsfc.nasa.gov/products/78
- Mons Mouton: https://en.wikipedia.org/wiki/Mons_Mouton — IAU Gazetteer https://planetarynames.wr.usgs.gov

## Horizon mask validation vs independent source (follow-up)
Source: PGDA products/69 (Mazarico et al. 2011, updated 2016-08): `AVGVISIB_85S_060M_201608.TIF` (32 MB) e
`_EARTH.TIF` (24 MB). They are 18.6-year averages, 60 m/px, int16 with **scale value/250 = %** (max 25000 = 100% Earth).
The `_COG.TIF` files listed on the page return 404 (HTML); I used the regular TIFs downloaded to `../ill/`.
I found no published table with lat/lon + %. The test points are the local maxima of the PGDA map itself (`pgda_points.json`).
Gläser et al. 2014 (EPSC, https://elib.dlr.de/94242/) gives 92.3% at 2 m and 95.66% at 10 m at Connecting Ridge (20 m DTM, 19 years), with no coordinates.

Our calculation: `horizon.py` (80 m LDEM, 150 km radius, 0 m mast) and `compare.js`. Average 2009-07…2028-02 every 3 h, with solar disc fraction.

| Point | lat | lon | PGDA Sun % | our 2027 % | our 18.6y disc % | Δ Sun | PGDA Earth % | our Earth % | Δ Earth |
|---|---|---|---|---|---|---|---|---|---|
| Connecting Ridge (peak) | −89.4749 | −137.443 | 88.4 | 86.9 | 86.4 | −2.0 | 58.1 | 53.0 | −5.1 |
| Shackleton rim | −89.6864 | −162.937 | 87.1 | 85.3 | 84.9 | −2.2 | 53.7 | 49.2 | −4.5 |
| Gerlache rim | −88.8089 | 123.756 | 86.0 | 85.2 | 85.2 | −0.8 | 56.5 | 55.8 | −0.7 |
| Malapert | −86.0011 | 2.055 | 81.9 | 71.7 | 71.3 | −10.6 | 58.7 | 59.0 | +0.3 |
| CR original (approx.) | −89.45 | −137.0 | 45.4 | 90.9 | 90.6 | +45.2 | 51.1 | 53.1 | +2.0 |

Reading:
- On the ridge peaks the error is between −0.8 and −2.2 p.p. for the Sun and between −0.7 and −5 p.p. for the Earth. The chain is OK.
- 2027 is close to the 18.6-year average (±0.5 p.p.).
- The PGDA map is very "spiky": in the 3×3 around each peak the value goes from 17–40% up to 86–88%.
  Tens of meters change everything. At (−89.45, −137) PGDA gives 45% and we give 91%, with 0..86% in the neighbors.
  Our mask ignores terrain at <300 m and uses an 80 m DEM, so it **does not capture the local slope or self-shadowing**.
- Malapert −10.6 p.p.: the peak of the 60 m map does not coincide with the 80 m DEM pixel (different height and slope).
  Another possibility is a distant horizon beyond 150 km. Not investigated.
- Recommendation: sample the PGDA map directly (Sun and Earth, 18.6 years) as the per-site mean "truth".
  The mask serves the time windows, with a 20 m DEM near the site (≤5 km) and 80 m far away.
  When displaying %, warn that the sensitivity is ~100 m.

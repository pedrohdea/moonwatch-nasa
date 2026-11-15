# MoonWatch — Ideas for the Lunar Landing Site Navigator

Status: research complete (A1 challenge partial, A2 validated calculation, A3 UX from memory) + browser prototype validated.

## Validated (evidence reproduced in this session)
1. **In-browser ephemeris**: astronomy-engine (114 KB min, MIT, offline). `RotationAxis(Body.Moon)` = IAU/WGCCRE model -> frame ≈ MOON_ME.
   Error vs JPL Horizons (DE441, MEAN_ME), Jan/2027 hourly, 745 pts:
   | Site | Sun max sep. | Earth max sep. |
   |---|---|---|
   | (0,0) | 0.0033° | 0.0025° |
   | Connecting Ridge (-89.45,-137) | 0.0033° | 0.0025° |
   | Mons Mouton (-84.6, 31) | 0.0033° | 0.0025° |
   Sanity check: Earth at the pole oscillates -7.5…+6.2° (period ~27.2 d, draconic); Sun at -89.45° stays 0.05…1.5°.
2. **Horizon mask**: LOLA LDEM_80S_80MPP (PGDA products/90, COG GeoTIFF), partial read via `/vsicurl/` (without downloading 181 MB), 150 km radius, 1° bins. ~2.6 KB JSON per site.
   Terrain changes the result: visible Sun drops 6–12 points vs flat horizon => mask is mandatory.
3. **Metrics** (`proto/metrics.js`, `node --test` 2/2 green). Browser (headless Chrome) == Node, identical.
   Jan/2027, 30 days, DTE ≥ 5°:
   | Site | Illuminated | Longest dark | DTE | Longest blackout | Sun+Earth |
   |---|---|---|---|---|---|
   | Connecting Ridge (approx.) | 100% | 0 h | 16.0% | 342 h | 16.0% |
   | IM-2 Athena | 46.9% | 314 h | 40.1% | 249 h | 31.1% |
   | Mons Mouton IAU center | 40.4% | 339 h | 40.4% | 248 h | 27.8% |
   WARNING: 30 days of January is misleading (Connecting Ridge 100% is a seasonal effect).
   Full year 2027, DTE threshold sensitivity (minimum absolute Earth elevation, beyond the terrain):
   | Site | Illuminated | Longest dark | DTE @0/2/5° | Longest blackout @0/2/5° | Sun+Earth @0/2/5° |
   |---|---|---|---|---|---|
   | Connecting Ridge (approx.) | 91.2% | 107 h | 45.2/35.3/17.2% | 360/422/548 h | 43.5/34.0/16.6% |
   | IM-2 Athena | 43.7% | 459 h | 71.9/60.1/44.7% | 191/267/363 h | 32.6/27.7/21.2% |
   | Mons Mouton IAU center | 31.6% | 549 h | 56.5/56.5/45.1% | 291/291/361 h | 20.9/20.9/17.3% |
   - The DTE threshold (5°) has NO source: it is a planner parameter; show the sensitivity, not a single number.
   - Qualitative insight (robust to any threshold): the most illuminated ridge (Connecting Ridge) is the worst for communication; IM-2 inverts it. The energy x DTE trade-off is what the tool reveals.
   - CORRECTION: (-89.45, -137) is NOT a ridge. PGDA gives 45.4% there; our 91% is false (the mask ignores terrain < 300 m and self-shadowing). The table above is valid as a pipeline test, not as Connecting Ridge data.

5. **Mask vs independent source** — PGDA products/69 (Mazarico 2011, v2016-08, 18.6-year average, 60 m; scale value/250 = % inferred, not documented). Ours: 80 m DEM, 150 km radius, 0 m mast, disc fraction, 2009–2028 average every 3 h.
   | Point | lat | lon | PGDA Sun | our Sun | Δ | PGDA Earth | our Earth | Δ |
   |---|---|---|---|---|---|---|---|---|
   | Connecting Ridge peak | -89.4749 | -137.443 | 88.4 | 86.4 | -2.0 | 58.1 | 53.0 | -5.1 |
   | Shackleton rim | -89.6864 | -162.937 | 87.1 | 84.9 | -2.2 | 53.7 | 49.2 | -4.5 |
   | Gerlache rim | -88.8089 | 123.756 | 86.0 | 85.2 | -0.8 | 56.5 | 55.8 | -0.7 |
   | Malapert | -86.0011 | 2.055 | 81.9 | 71.3 | -10.6 | 58.7 | 59.0 | +0.3 |
   | Original CR point (approx.) | -89.45 | -137.0 | 45.4 | 90.6 | +45.2 | 51.1 | 53.1 | +2.0 |
   - Peaks: pipeline validates (Sun -0.8 to -2.2 p.p.; Earth -0.7 to -5 p.p.). Malapert: -10.6 p.p. with no cause investigated.
   - Gläser 2014: Connecting Ridge 92.3% at 2 m (19 years, 20 m DEM), no coordinate — compatible.
   - % changes from ~20% to ~88% within 60–180 m: sensitive to ~100 m of position. Warn in the UI.
   - Energy x DTE insight: downgraded to a hypothesis. On the validated peaks, Earth 49–56% (ours) / 54–59% (PGDA) vs IM-2 ~72% (mask not validated at IM-2). Revalidate IM-2 against PGDA before using it in the pitch.

### Data recommendation (post-validation)
- Mean Sun/Earth % per site: sample the PGDA 69 map directly (~56 MB once, offline) -> 1 number per site in the JSON. Citable source.
- Time windows (Gantt, polar, metrics): 360-bin mask with 20 m DEM nearby (≤ 5 km) + 80 m far away, and include nearby terrain (< 300 m).
- Coordinates: use the PGDA local maximum within the region, not an approximate coordinate.
4. **Prototype**: `proto/index.html` (sky polar plot with terrain + 3-site Gantt + 5 metrics). Screenshot `proto/shot.png`.

## Technical gotchas (A2)
- `RotationAxis().ra` in HOURS: x15.
- Use `RotationAxis`, not `Libration()` (geocentric optical libration).
- Horizons `SITE_COORD` = `'Elon,lat,alt'` (reversed order).
- MOON_PA vs MOON_ME ~0.03° (~875 m): DEM and Horizons in ME.
- 80 m DEM underestimates the near horizon (<1–2 km); final site: 20 m / 5 m (products/78).
- Sun = 0.53° disc: a threshold at the center over/underestimates; stretch = fraction of the visible disc.

## Recommended roadmap (to bring into the repo)
1. `site/shared/vendor/astronomy.browser.min.js` + `site/shared/ephem.js` (port of `moonAzEl.js`) + `metrics.js` + test.
2. Offline script `scripts/horizon.py` generates `site/shared/data/horizons/<site>.json` for the 9 Artemis III + CLPS sites (coordinates: find a source).
3. Current chart becomes elevation x time (Sun/Earth) with an H line = DTE threshold; V lines = [landing, end] window => metrics recompute on drag.
4. New sky polar section (Canvas, no lib) + comparative Gantt; the `#pouso` globe becomes a site selector.
5. Stretch: "next good date" (scans 1 year, Sun+Earth score), heat calendar, 360° panorama, solar disc fraction, pt-BR/EN.

## Central gap
Current site = chart/table/globe with fictitious data. The core of the challenge is missing:
real az/el of the Sun and Earth per site + terrain horizon mask.

## Ideas (source: A3, from memory — validate URLs/DOIs)
### Visualizations
1. Sky polar plot (az x el): horizon silhouette + Sun track + Earth libration ellipse. Shows why terrain decides everything at the pole.
2. Elevation x time (current chart): Y = elevation, Sun and Earth, shadow below the mask.
3. Gantt per site: Sun / Earth / both bands. Best idiom for comparing sites.
4. Day x hour heat calendar: "Sun and Earth visible" -> find the landing date.
5. 360° panorama (azimuth strip) with silhouette, Sun and Earth — public/educator appeal.
6. Sortable score table per site.

### Reuse of current features
- H line = minimum elevation (DTE preset 5°; ~1° solar panel).
- V lines: V1 = landing, V2 = end (+14 d), metrics only in [V1, V2], recompute on drag; state in the URL = shareable link.
- Table = hourly ephemeris (Sun az/el, Earth az/el, flags).
- Globe = site selector (`?sites=`) -> opens Gantt + ranking.

### 5 metrics per site/window
1. Illuminated fraction.
2. Longest continuous darkness (h) — battery/survival.
3. DTE fraction (Earth > mask and > 5°).
4. Longest communication blackout (h).
5. Sun+Earth overlap (operational window).
Extra: "next good date" = next V1 with a score above the threshold.

### MVP vs stretch
MVP: pre-computed JSON 1 year/1 h per site; 5-metric panel; Gantt; elevation x time; polar plot in Canvas; approximate mask labeled as such; pt-BR/EN; Okabe-Ito palette.
Stretch: real LOLA mask (3–5 sites), heat calendar, 360° panorama, date ranking, CSV/PNG export, educator mode, PWA.

### Risks
- Without a real LOLA mask the absolute numbers are not usable for decisions: label as "approximate".

## Challenge and context (source: A1 — partial)
- Challenge page not read (TLS certificate error). Challenge summary is already in the README. Resources tab: pending — Pedro to paste.
- Criteria: impact, creativity, validity, relevance, presentation (judging-awards-guide).
- Market gap: Horizons/SPICE exact but with no terrain or visual comparison; Moon Trek/QuickMap online and heavy; PGDA/LOLA (Mazarico 2011, pgda products/69) static maps. None compares sites x dates side by side, offline, with horizon. => MoonWatch pitch.

### Sites with confirmed coordinates
| Site | lat | lon | Source |
|---|---|---|---|
| IM-2 Athena (Mons Mouton) | -84.79 | 29.20 | Wikipedia IM-2 |
| IM-2 target (LROC) | -84.78 | 29.13 | lroc.asu.edu/images/1401 |
| Chandrayaan-3 | -69.373 | 32.319 | from memory — verify |

Artemis III (Oct/2024, 9 regions ~15x15 km): Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. Coordinates still without a source.

### Physics (from memory — validate with A2)
- Lunar axial tilt ~1.54° => max Sun ~1.5° + (90 - |lat|) at the pole.
- Libration ±6.7° lat / ±7.7° lon => Earth oscillates ~±7° at the polar horizon.
- Polar ridges: 77–88% of the time illuminated (PGDA 69).

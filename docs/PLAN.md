# MoonWatch — 3 local sites with an interactive chart (library comparison)

## Context

The `moonwatch-nasa` repo only has README/LICENSE (+ `docs/PLAN.md`, an old draft still based on Horizons). Pedro wants a local single-page site with anchors `#home`, `#track`, `#about`, and a robust chart where clicking a line filters the data below it, with infinite scroll. To compare tools: **3 versions of the same site, each with a different chart library, on different ports**, built by **3 sub-agents**. Every future update applies to all 3.

Decisions from the chat (they go into `docs/PLAN.md`):
- Infinite scroll **in the table inside `#track`** (scrollable box); `#about` always reachable.
- **Fictional data, nothing from the internet**: 6 series = types of math functions, only to test usability.
- Design: **Space Apps 2026** identity (official Brand Guide, PDF dated 05/23/2025).
- 3 variants: **ECharts**, **Plotly.js**, **Chart.js** — ports 8001, 8002, 8003.
- Branch: `feat/moonwatch-site`.

## Architecture: shared core + one adapter per library

"Always apply to all 3" = everything that is not the chart lives in `site/shared/` and is used by all 3. Only the chart drawing changes.

```
site/
  shared/
    series.js      # 6 functions, 2001 points each, filterRows()  (window.MoonSeries + module.exports)
    core.js        # filter state: MoonCore.setFilter(i|null), onFilterChange(cb), active series
    table.js       # table with infinite scroll (batch of 50, IntersectionObserver, reset on filter)
    layout.js      # injects nav + #home + #track (chart container, badge, buttons, table) + #about
    style.css      # Space Apps tokens, fonts, hero gradient, responsive
  echarts/  index.html, chart.js, vendor/echarts.min.js        (+ symlink shared -> ../shared)
  plotly/   index.html, chart.js, vendor/plotly-basic.min.js    (+ symlink shared -> ../shared)
  chartjs/  index.html, chart.js, vendor/chart.umd.min.js, vendor/chartjs-plugin-zoom.min.js, vendor/hammer.min.js (+ symlink)
scripts/serve.sh   # starts 3 servers: python3 -m http.server 8001/8002/8003, each in the variant's folder
tests/series.test.mjs, tests/core.test.mjs   # node:test
```

A `shared` symlink inside each variant: each port serves only its own folder and still sees the core (http.server follows symlinks). A single place to edit.

Adapter contract (`<lib>/chart.js`), the only file each sub-agent writes besides the vendor files and `index.html`:
- `MoonChart.render(container, MoonSeries.all)` — draws 6 series, legend, tooltip, zoom/pan, reset-zoom button.
- Click on a line → `MoonCore.setFilter(seriesIndex)`; click on an empty area → `MoonCore.setFilter(null)`. Zoom/drag does not filter.
- `MoonCore.onFilterChange(i => ...)` → highlights series `i` (thicker) and fades the others; `null` restores.
- Series colors come from `MoonSeries.colors` (core), identical in all 3.

How each library handles the click on the line:
- ECharts 5.6.0: `series.triggerLineEvent:true` + `chart.on('click', {seriesType:'line'}, p => p.seriesIndex)`; empty area via `chart.getZr().on('click', e => !e.target)`; native `dataZoom` inside + slider.
- Plotly.js basic 2.35.2: `plotly_click` → `curveNumber`, `hovermode:'closest'`; empty area via click on the plot without a point (`plotly_click` does not fire) → listener on the container with a flag; native zoom/pan, `plotly_relayout` ignored.
- Chart.js 4.4.1 + plugin-zoom 2.0.1 + hammerjs 2.0.8: `getElementsAtEventForMode(e,'nearest',{intersect:false},true)` with a ~12 px tolerance; dragging suppresses the click (pointerdown→up distance).

## Design (Space Apps Brand Guide)

The `spaceappschallenge.org` site refuses TLS from here; values came from the PDF at `assets.spaceappschallenge.org`.
- `:root` tokens: `--deep-blue:#07173F` (background), `--electric-blue:#0042A6`, `--neon-blue:#0960E1`, `--blue-yonder:#2E96F5`, `--neon-yellow:#EAFE07` (accent only, never a background), `--rocket-red:#E43700`, `--martian-red:#8E1100`, `--white:#FFF`.
- Hero: 45° linear gradient Electric Blue → Deep Blue. Text only over Deep Blue, Electric Blue or white.
- Fonts (Google Fonts, OFL; fallback `system-ui`/`monospace` offline): headings Fira Sans 900/700; body Overpass 400/700; numbers Fira Code.
- Colors of the 6 series with contrast ≥ 3:1 over `#07173F` (Blue Yonder, Neon Yellow, light Rocket Red, white, light blue, coral/cyan).

## Data (`shared/series.js`)

x ∈ [0, 10], step 0.005 → 2001 points/series, 12,006 rows. All in y ∈ [0, 10]:
Linear `x` · Quadratic `x²/10` · Cubic `x³/100` · Exponential `10(e^(x/4)−1)/(e^2.5−1)` · Logarithmic `10·ln(1+x)/ln(11)` · Sinusoidal `5+5·sin(x)`.

## Steps, owners and time

Total ≈ 60–80 min (sequential core + 3 sub-agents in parallel).

| # | Step | Who | Checkpoint | Time |
|---|---|---|---|---|
| 1 | Branch `feat/moonwatch-site`; rewrite `docs/PLAN.md` | me | branch created | 5 min |
| 2 | Core: `series.js`, `core.js`, `table.js`, `layout.js`, `style.css` + node tests | me | `node --test tests/` green | 20–25 min |
| 3 | `scripts/serve.sh` + structure of the 3 folders with symlink | me | 3 ports answer 200 | 5 min |
| 4a | ECharts variant | sub-agent 1 (sonnet) | click filters, zoom ok | 10–15 min |
| 4b | Plotly.js variant | sub-agent 2 (sonnet) | same | 10–15 min (parallel) |
| 4c | Chart.js variant | sub-agent 3 (sonnet) | same | 10–15 min (parallel) |
| 5 | Cross-review + hardening on all 3 (empty click, zoom does not filter, hidden legend + filter, filter change mid-scroll, 390 px, clean console; headless screenshot if Chrome is available) | me | checklist green on all 3 | 12–15 min |
| 6 | README ("Run locally", library comparison) + commit | me | commit on the branch | 5 min |

Sub-agents: `sonnet` (the cheapest that can handle a lib API + events; haiku risks getting click/zoom details wrong). Each one receives: the adapter contract, the core paths, the lib version, and the rule "do not edit `shared/`" (a core change comes back to me, so it applies to all 3).

Gotchas between steps:
- 2→4: `MoonCore`/`MoonSeries`/`MoonChart` contract frozen before the sub-agents; no ESM (works on `file://`).
- 4: a sub-agent does not edit `shared/`; if needed, it reports and I apply it (applies to all 3).
- 4b: Plotly basic does not include WebGL; 12k points in SVG is fine.
- 4c: plugin-zoom needs hammerjs loaded first.
- 5: changing the filter re-observes the table sentinel (already in the core).

## Verification

Automatic:
- `node --test tests/` (series: 6 × 2001, y ∈ [0,10]; core: setFilter notifies, null clears; filterRows).
- `node --check` on each `chart.js`.
- `curl -s -o /dev/null -w "%{http_code}"` on ports 8001/8002/8003 → 200.

Manual (`scripts/serve.sh`, open `localhost:8001`, `:8002`, `:8003`):
- Menu leads to `#home`, `#track`, `#about`.
- Click the Sinusoidal curve → table shows only Sinusoidal, badge "2001 rows", series highlighted.
- Click empty area / "Clear filter" → 12,006 rows.
- Scroll the table → +50 at a time; `#about` reachable.
- Zoom/pan does not filter; reset goes back.
- ~390 px with no horizontal page scroll.

## Execution status (2026-11-14)

- Core `site/shared/` + 3 adapters (`site/echarts`, `site/plotly`, `site/chartjs`) ready; each adapter built by one sub-agent (sonnet).
- The Python template `.gitignore` ignored `/site` (mkdocs); line commented out.
- `index.html` of the 3 versions generated identically (only lib and vendor change), to keep the 3 in sync.
- Bug fixed in Plotly: `plotly_click` fires before the DOM `click`, and the empty-area handler cleared the filter right after. Fix: compare timestamps (300 ms window).
- Verification: `node --test` (4/4) and `tests/e2e.mjs` via headless Chrome at 1280 px and 390 px — all checks OK on the 3 versions.
- Known pending items: Plotly modebar in English (basic does not ship the pt-BR locale); ECharts slider mini-preview gray (cosmetic).

## Update: datasets (2026-11-14)

Pedro's request: use the charts from https://www.tylervigen.com/spurious-correlations and the list of 20 curve types as examples; each chart with its equivalent table below.

Decisions:
- `shared/series.js` now has datasets, chosen by `?dataset=<key>` (selector in the Track section). Switching datasets reloads the page: the adapters do not need to know how to redraw.
- `curvas`: 20 curves from the list, x from 0 to 10, y between 0 and 10, 2001 points each. Parametric = cycloid (x not uniform, but increasing — required for Chart.js decimation).
- 4 real spurious correlations (boat, corn, malta, sarah). Data extracted from the pages and validated: the recomputed Pearson r matches the page's up to the 7th decimal in all 4 cases.
- Two quantities with different units on the same axis: each series min-max normalized to 0–10 (equivalent to the 2 Y axes of the original site). The real value stays in the 3rd field of the point and appears in the tooltip and the table.
- Equivalent table: spurious ones in wide format (Year | series A | series B), as on the original site; clicking a chart line leaves only Year + that column. Curves keep long format (one row per point), because Parametric does not share the x values of the others.
- Adapter contract: ranges and axis titles come from `MoonSeries.dataset`; years without a thousands separator. The 3 adapters were updated by 3 sub-agents (sonnet).
- `tests/e2e.mjs` became generic: it finds in each series the most isolated point and the empty point farthest from the lines; runs on `curvas` and `sarah`.

## Update: chart from the table + confidence (2026-11-14)

Pedro's request: do not show the formula on the site; the chart should arise from the table points; each point has a confidence.

Decisions:
- Formula removed from the table and the site (stays only as documentation in the `series.js` code).
- Curves: 21 "measured" points per curve (x from 0 to 10, step 0.5) instead of 2001 theoretical points. Measured = theoretical value + noise limited to ±0.4, generated by a fixed-seed PRNG (same data on every load and in the tests).
- Point = `[x, y, realValue|null, confidence]`. The chart draws markers on all points connected by straight lines (no smoothing), so each marker = one table row.
- Confidence (0–100%):
  - curves: `100 − 25·|measured − theoretical|/0.4` (75–100%);
  - spurious: agreement of the normalized series in that year, `100·(1 − |A − B|/10)`, the same for both series of that year.
- Display: "Confidence" column with a bar in the table; tooltip; marker size proportional in all 3 charts.
- E2E: lines interpolated between points; ambiguous click (overlapping series, e.g. Malta) becomes SKIP and the filter is applied via `MoonCore` for the remaining checks.
- Plotly: `hoverdistance` 20 → 12 px (same as Chart.js), otherwise with 20 curves on a phone there is no empty area left to clear the filter.

## Update: confidence visualization versions (2026-11-14)

Pedro's request: the chart should illustrate the point–curve confidence. Options presented in a quiz; answer: "test them all and make versions in the header", with sub-agents.

Decisions:
- 5 modes, chosen by `?viz=` ("Confidence" pills in the header, preserving the dataset and the library): `tamanho`, `desvio` (default), `cor`, `faixa`, `rotulo`.
- Point gets a 5th field `refY`: value of the theoretical curve (curves) or of the other series in the same year (spurious). Each series has `reference` (201 samples of the theoretical curve; or the points of the other series).
- A single color scale for the 3 libs: `MoonSeries.accuracyColor` (red `#FF6A3D` → Neon Yellow → green `#3DDC84`) over the dataset's confidence range.
- Focus (`MoonSeries.focus`): deviation, band and label draw only on the filtered series; without a filter, on all of them if there are ≤ 4 series (spurious). With 20 curves and no filter the notice "Click a line to see." appears.
- Band tolerance: curves ±0.4 (maximum noise); spurious ±1 (= 90% agreement).
- Decorations are never clickable nor part of the legend/tooltip, so they do not shift the filter indexes.
- 1 sub-agent (sonnet) per library, with a common spec.
- E2E runs through dataset × mode × library (`VIZ=`, `DATASETS=`, `W=`).

## Update: random confidence + link fixes (2026-11-14)

Pedro's requests: random confidence and a more evident difference; bug "when selecting the yellow curve, it shows the confidence of the blue one".

Decisions:
- Confidence drawn per point (5–100%), a new draw on every load; `?seed=N` repeats it. Library and mode links carry the `seed`, to compare versions with the same points; "Draw again" link.
- Curves: point displaced from the theoretical curve by `(1 − acc/100)·2.5`; tolerance band ±1.25 (outside = < 50%). Real correlations: real values kept, only the confidence is drawn (the deviation stroke shows the real distance to the other series; the color shows the drawn confidence).
- More evident: fixed color scale 0–100%; marker 3–14 px (`MoonSeries.markerSize`, common to the 3 libs); labels colored by confidence.
- Link bug (table): the confidence column of the correlations always read the 1st series. Now there is one confidence column per series; with a filter, only the chosen series'. E2E checks that the table confidence matches the filtered series.
- Decorations (deviation/band/label) only on the clicked series; before, with no filter, the two correlation series drew overlapping strokes.
- Plotly: hover only measures distance to points; a click between markers now tests the distance to the segment (12 px), as in Chart.js.
- E2E: fixed `seed`; click ambiguity measured in pixels (16 px).
- Real correlations: the reference stopped being "the other series" and became a fictional expected value at `(1 − acc/100)·2.5` from the real point. Thus, in all datasets, distance to the reference, color and % mean the same thing (before, a long stroke could come out green).

## Update: landing sites with an animated globe (2026-11-14)

Pedro's request: when selecting a mission, an animation that takes you to its coordinates on the Moon (list of moon3dmap.com links with lat/long). Quiz: "New section" + "Make the 3 versions so I can compare later".

Decisions:
- New section `#pouso` ("Landing & Impact Sites") in `site/shared/landing.js`, right after `#mission`; applies to the 3 ports. "Landings" link in the menu.
- 16 missions. Correct agency per mission (NASA, USSR); Luna 2 and Ranger 7 are impact sites. Moon3DMap URL built from slug + lat/long (`toFixed(4)`, same as the pasted links).
- A single mission selector, shared by the 3 rendering tabs (switching tabs keeps the mission):
  - **Canvas**: orthographic globe drawn pixel by pixel on a 2D canvas; zero dependencies.
  - **three.js**: WebGL sphere with light; `three.min.js` r158 (last UMD) in `site/shared/vendor/`, loaded only when the tab is opened (does not weigh on the chart pages).
  - **Moon3DMap**: moon3dmap.com iframe with the mission's URL; `src` is only set with the tab open (the rest of the site stays offline); fallback link always visible.
- Animation (Canvas and three.js use the same `{lat, lon, zoom}` state): zooms out, rotates along the shortest path in longitude (e.g. a site near 177° E → Luna 9 crosses 180°) and zooms in to the site, ~2.6 s, cubic easing. `prefers-reduced-motion` jumps straight there. `requestAnimationFrame` only runs during the animation.
- Texture: NASA SVS CGI Moon Kit, LROC color 2k (public domain), converted from TIF to JPG (378 KB) in `site/shared/vendor/moon-2k.jpg`. Credit next to the globe.
- Pure math (orthographic projection, shortest path, interpolation, three.js rotation) exported via `module.exports` and tested in `tests/landing.test.mjs`. `window.MoonLanding` hook for the E2E.
- Fictional points (Pedro's request: "I saved a csv with fictional points on the Moon; show it in the animation"): `dLandingSites.csv` moved from `docs/` to `site/shared/data/` (the site needs to serve it). 50 points, 10 groups of 5 per `missionID`; the IDs do not match the 19 missions, so they become the group "Fictional points (CSV)" in the selector.
  - Group center = mean of the unit vectors (correct near the pole and 180°); zoom computed to separate the 5 points (up to 120×). Above ~10× the 2k texture just blurs: Canvas now samples with a bilinear filter (before, nearest neighbor pixelated).
  - Points of all groups appear in orange on the globe; the chosen group turns yellow and gets a table (ID, name, lat, long, PRSID, NEARESTCOLD).
  - Moon3DMap: no slug for a fictional point, uses `https://moon3dmap.com/pt/?lat=…&long=…`.
  - Zoom interpolated on a log scale (1.8× → 120× is uniform). An invalid row in the CSV is discarded.
- Review (Pedro: "too much zoom; multiple-choice selector; frame all points with autoscale"):
  - CSV groups left the mission `<select>` and became checkboxes ("Fictional points (CSV)", with All/None). `MoonLanding.setGroups(keys)`.
  - Autoscale (`frameSites`): center = mean of the unit vectors of the marked points; zoom so the farthest point sits at ~80% of half the view; minimum 1× (whole disc), maximum 6× (before 120×). A single group (5 points within < 0.2°) ends up in a single cluster; the values are in the table.
  - The table lists the points of all checked groups (with a Group column). Mission and groups: the last one chosen defines the view.
  - CSV points drawn on top of the mission markers (group 4 has the same coordinates as Apollo 14).

## Update: "Viability" dataset in the chart (2026-11-14)

Pedro's request: use `docs/fLandingSites_viability.csv` (LANDINGSITEID, DATE, VIABILITY; 50 sites × 731 days, 2024-01-01 to 2025-12-31, values 0–200). Quiz: "Viability in a chart", "10 groups, daily average", "Data only for now".

Decisions:
- `?dataset=viabilidade`: one series per group (missionID from `dLandingSites.csv`) = daily average of the 5 sites; 10 series × 731 points.
- Data: `scripts/build-viability.mjs` generates `site/shared/data/viability.js` (39 KB) from the 2 CSVs; validates consecutive days and invalid rows. The source CSV stays in `docs/` (it was open in LibreOffice). Run the script again if the CSV changes.
- `viability.js` loaded before `series.js` on the 3 pages; without it the dataset simply does not appear.
- X axis = day index (0 = 2024-01-01), because showing a date on the axis requires touching the 3 `chart.js` files, which another session was editing (fill between curve and lines). The table shows Date + Day + Viability. **Pending:** format the x axis and the tooltip as a date in the 3 adapters (`MoonSeries.dataset.xDate(day)` already exists).
- Random confidence as in the spurious correlations; reference at `(1 − acc/100)·50` (maximum deviation scaled from 0–10 to 0–200); band ±25.
- Test: `tests/viability.test.mjs` (average recomputed from the raw CSV; point contract).

## Update: guide lines, areas and simplification (2026-11-15)

- Vertical lines: one per series (default and maximum), series color, follow the legend (hidden series = no line, no fill, no card); switching datasets restarts from the default.
- Single horizontal line "Minimum viability" (yellow, `?minima=`), common to all series; each series' fill = above it and to the right of its vertical; large cards with the area (shoelace) per series.
- Only the arrows drag (line bodies were stealing clicks on the curves); chart with lines only, no points.
- Chart right below the data selector; controls and table at the bottom.
- Confidence modes "Size" and "Deviation" removed on request; Color, Band (default) and Label remain.
- Chart.js only (port 8003): ECharts and Plotly.js versions removed on request.
- "Vertical lines" renamed to "Transit time". New "Departure" line (white, `?partida=`, date field in the viability dataset): Vk = Departure + time k; moving the Departure shifts all Vk keeping the times (kept even if the line hits the axis edge); dragging/typing a Vk changes only its own time. Default: times distributed between the Departure and the end of the axis.
- The series filter also filters the transit time (line, chip) and the area cards.
- 3 missions removed from the globe list, the documentation and the tests on request (16 missions).

## Update: English site and code (2026-11-15)

User request: whole site and code in English, NASA-style mission wording. Keys renamed (datasets `curves`/`boat`/`corn`/`malta`/`sarah`/`viability`; confidence modes `color`/`band`/`label`; URL params `transit`/`threshold`/`departure`; anchor `#sites`), en-US numbers, ISO 8601 dates. Glossary: Confidence, Departure, Transit time, Minimum viability, Viable area, Landing & Impact Sites, Mission Definitions, Direct-to-Earth (DTE). This file is the decision log.

## Update: NASA 3D assets in Landing & Impact Sites (2026-11-15)

Request: use NASA options 1 (SVS Moon 3D models), 3 (NASA 3D Resources) and 4 (Moon Trek). Quiz decisions: version `moon_small.glb` in the repo; keep everything local (offline, repo +~74 MB); keep the Moon3DMap tab and add a Terrain 3D tab.

- `scripts/fetch-nasa-assets.mjs` vendors everything into `site/shared/vendor/` (`nasa/` + `three/`) and writes `nasa/SOURCES.md`. `.gitattributes` marks `*.glb`, `*.stl`, `*.jpg` binary; no git-lfs.
- three.js r158 moved from the UMD `three.min.js` (removed) to ES modules: import map `three` in `site/chartjs/index.html`, loaders imported dynamically from the classic `landing.js` (still lazy, only when a 3D tab opens).
- three.js tab (option 1): `moon_small.glb`, scaled by half its box width (bounding sphere of a sphere's box is √3·R), `GLB_YAW = -π/2` measured with screenshots (lon 0 faces -Z in the SVS frame). Frontal light so no site sits in the dark. Fallback: textured sphere.
- Canvas tab (option 4): CGI Moon Kit 2k first, then the 16×8 Moon Trek LRO WAC tiles (zoom 3, 256 px) stitched into a 4096×2048 texture; same equirectangular frame (top-left -180°, 90°). `MoonLanding.renderers.canvas.texture` reports the source for the E2E.
- Terrain 3D tab (option 3): Apollo 11/12/14/15/16 STL height maps, centered and scaled to 2 units, colored by height NASA blue → Neon Yellow, slow turntable + drag. Gotchas: the STLs ship zero normals (`computeVertexNormals`) and inverted winding (`DoubleSide`); `geometry.translate()` recomputes `boundingBox` in place (clone it first); the Lunar Module GLB is Draco-compressed (vendored `DRACOLoader` + decoder). LM not to scale. Other missions: "3D terrain available for Apollo 11, 12, 14, 15 and 16".
- Tests: unit (Trek tile grid, STL mission mapping), E2E (Trek texture 4096×2048, GLB source, Terrain 3D for Apollo 11 + LM, message for Luna 9), desktop and 390 px.

## Plan: hook video as full-screen intro (2026-11-15) — approved, then replaced (see below)

Request: use `docs/video/hook_newspaper.mp4` (5 s, 1920×1080, 14.7 MB, no audio; "The Lunar Gazette": "At the lunar south pole, a four-day launch slip can mean months of waiting, and millions lost", made in session `session_018cxk3pLr2GZZbmfUKRTaof` by `docs/video/hook_newspaper.py`) in the opening of the site. Quiz decisions: **full-screen intro** that plays and then reveals the hero; site loads a **720p compressed** copy; version **only the `.py` and fonts** of `docs/video/` (fonts are SIL OFL, `OFL.txt` included); the original mp4 stays out of git (regenerable).

Steps (small, verifiable):
1. Asset. `site/shared/media/hook_newspaper.mp4` = `ffmpeg -i docs/video/hook_newspaper.mp4 -vf scale=1280:-2 -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an` (target 1–2 MB). Poster `hook_newspaper.jpg` = last frame (stamp visible), `-sseof -0.1 -frames:v 1`. `.gitattributes`: `*.mp4 binary`. `.gitignore`: `docs/video/*.mp4`, `docs/video/.ruff_cache/`. Command recorded in README.
2. `site/shared/intro.js` (classic script after `layout.js`). Fixed full-screen overlay `#intro` (deep-blue background, `<video muted playsinline autoplay preload="auto" poster>`, `object-fit: contain` = letterbox on phones), yellow **Skip** button (focused on open; Esc also skips), page scroll locked while open.
   - On `ended`: hold the last frame ~1.2 s (the stamp is the punchline), fade out 600 ms, remove the overlay, focus the hero `h1`.
   - Never blocks the site: if `play()` is rejected, the video errors, or it is not playing after 3 s, the overlay is removed at once.
3. When it shows: pure `shouldShowIntro({hash, search, reducedMotion, seen})`, exported for node tests.
   - Shows on the first visit of the session (`sessionStorage`, try/catch).
   - Skipped for deep links (hash other than `#home`, e.g. `#sites`), `?intro=0` and `prefers-reduced-motion`.
   - `?intro=1` forces it. The existing E2E URLs all use `#track`/`#sites`, so they stay unaffected.
4. Hero: small ghost button "▶ Watch intro" reopens the overlay. Text alternative: visually hidden headline inside the overlay (`aria-label` on the dialog).
5. Tests and docs:
   - Unit: `shouldShowIntro` cases.
   - E2E: `/?intro=1` shows `#intro` and the video plays; Skip removes it; after `ended` it is removed (wait ~7 s); `#sites` has no intro; 390 px has no horizontal scroll and the console stays clean.
   - README and this file updated; one commit.

Acceptance (manual): fresh tab `http://localhost:8003/` → intro plays, stamp, fade into the hero; reload in the same tab → no intro; Skip / Esc work; `/#sites` → no intro; OS "reduce motion" → no intro; phone portrait → letterboxed video, Skip reachable; offline still works.

Simplest-solution check: native `<video>` + ~60 lines of JS/CSS; no library. No sub-agents (one coupled change).
Risk: every new session waits up to ~6 s before seeing the hero unless Skip is used.

### Change: intro section instead of the full-screen overlay (2026-11-15)

Pedro, after seeing the overlay working: "play the intro video inside the section, create a section on top. in a loop, with a stop button." Implemented instead of the overlay:
- New section `#intro` above `#home` (`site/shared/intro.js`): 16:9 frame inside `.wrap`, `<video muted loop playsinline autoplay>` + poster, yellow **Stop / Play** button (bottom right). Reduced motion: no autoplay, poster shown, button says Play.
- Dropped: overlay, Skip/Esc, once-per-session rule, `?intro=`, "Watch intro" button, `shouldShowIntro` unit test.
- Kept from the plan: 720p web copy (1.3 MB) + poster in `site/shared/media/`, `docs/video/*.mp4` ignored, `.py` + OFL fonts versioned. `scripts/serve.mjs` gained MIME types (mp4, jpg, json, wasm).
- E2E: section sits right before `#home`, video loops and plays, Stop pauses, Play resumes.
- Follow-up (Pedro: "make it auto stop, at the end of the video"): no `loop`; the video plays once and stops on the last frame (stamp); the button turns into Play, which replays from the start.
- Follow-up (Pedro: "add another section, same model, at the end with another video: docs/video/closing_moonwatch.mp4"): `site/shared/intro.js` became `site/shared/videos.js`, one config per video. New `#closing` section after `#about` with `closing_moonwatch.mp4` (web copy 0.57 MB). It stops at 4.5 s because the video fades to dark after 4.6 s; the poster is that frame. Both videos now start when half of the frame is visible (IntersectionObserver), so the closing one does not play off screen.
- Gotcha: `scripts/serve.mjs` did not answer HTTP `Range`, so `<video>` was not seekable (`seekable` = [0, 0]) and the 4.5 s stop jumped back to 0. The server now returns 206 + `Content-Range` (any static host already does).

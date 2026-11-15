# moonwatch-nasa
Project MoonWatch - from Space Apps Challenge - by Myr Battlesphere Team

About the Team
https://www.spaceappschallenge.org/2026/find-a-team/myr_battlesphere/

NASA’s Commercial Lunar Payload Services (CLPS) program and other lunar missions depend on careful selection of landing sites and dates that balance the needs of both science and engineering teams. One of the most significant challenges in this process is understanding the local lighting and communication environment at a potential landing site. 

## Run locally

Site at http://localhost:8003/, charts with Chart.js 4.4.1 + chartjs-plugin-zoom 2.0.1 (local libraries).

```bash
./scripts/serve.sh   # serves the site on port 8003 (Node, no browser cache); Ctrl+C to stop
node --test          # core tests (tests/*.test.mjs)
# E2E (line click, empty area, drags, legend, infinite scroll):
google-chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank &
node tests/e2e.mjs   # W=390 node tests/e2e.mjs for phone width
```

- Single page with anchors `#home`, `#track`, `#sites` (Landing & Impact Sites), `#mission` (Mission Definitions, below the Moon map), `#about`.
- Click a chart line: the table below shows only that series. Click an empty area or "Clear filter" to see everything.
- Tables are collapsed by default (Expand/Collapse), with a text filter and column sorting (click the header; click again to reverse).
- "Viable area" cards sorted from the largest to the smallest area; the largest is green.
- Table equivalent to the chart right below it, with infinite scroll (50 rows at a time) inside its own box.
- Transit time (draggable vertical lines): one per chart series (V1...Vn, in the color of series n), each with a small arrow ▼ on the top edge of the chart. Drag the arrow to move the line, type in the line chip, "×" removes it and "+ Transit time" adds it back (maximum = number of series). Positions in the URL (`?transit=`).
- Departure: white vertical line with a draggable ▼ "Departure" and an input field (a date in the viability dataset; `?departure=`). Each transit time is measured from it: Vk = Departure + time k. Moving the Departure moves all transit-time lines together; the transit-time chips show the duration.
- Deadline: orange vertical line with a draggable ▼ "Deadline" and a date field (`?deadline=`, default = end of the period). Viable areas and fills only count up to the deadline (from each Vk to the Deadline). Missions with a zero viable area have their card hidden.
- With a filtered series, "Transit time" and the area cards show only the chosen series.
- Minimum viability: a single yellow horizontal line, shared by all series, with a ◀ arrow on the right edge of the chart to drag and an input field to type in. Value in the URL (`?threshold=`).
- Transit time follows the legend: hiding a series hides its vertical line, its fill and its area card.
- The chart shows only lines, without points (except in the "Color" confidence mode, which needs the markers).
- Fill: each curve is painted (series color, translucent) between it and the minimum viability, only where the curve is above that line and to the right of the series' vertical line (Vk). With a filter, only the chosen series. Follows the dragging of the lines.
- "Dataset" selector (`?dataset=<key>`):
  - `curves` - 20 types of math curves, simulated data, 21 measured points per curve (linear, quadratic, parabolic, cubic, quartic, polynomial, exponential, logarithmic, hyperbolic, rational, absolute value, inverse, power, square root, piecewise, implicit, parametric, trigonometric, sine, cosine).
  - `boat`, `corn`, `malta`, `sarah` - real spurious correlations from [Tyler Vigen](https://www.tylervigen.com/spurious-correlations) (CC BY 4.0). Each series is normalized to 0-10 in the chart; the table shows the real values, one row per year, as on the original site.
- The chart is drawn from the table points (straight lines joining the points). Each point has a **confidence** (0-100%), shown in the table and the tooltip:
  - curves: closeness of the measured point to the theoretical curve (fixed noise per seed, 75-100%);
  - random in this prototype (5-100%, new draw on every load; `?seed=N` repeats it). The point sits at `(1 - acc/100)·2.5` from the reference: 100% is right on it.
- Confidence visualization versions in the header (`?viz=<mode>`), switched without reloading the page (filter, legend, lines and tables stay; only the chart is redrawn):
  - `color` - marker color (red → yellow → green);
  - `band` (default) - tolerance band around the reference;
  - `label` - `NN%` written on each point.
  Reference = theoretical curve (curves) or simulated expected value (spurious correlations). Band and label appear only on the clicked series, to avoid mixing series.
- E2E: `VIZ=band,color DATASETS=curves node tests/e2e.mjs` limits modes and datasets.
- `viability` - simulated viability of the 50 sites (`docs/fLandingSites_viability.csv`), one series per mission (daily mean of its 5 sites), 731 days. X axis in days (date in the table). Mission names = missions in `docs/dMission.csv` (`ID` = `missionID`; the objective shows as a hint). If any CSV changes: `node scripts/build-viability.mjs`.
- `viability` is the default dataset. The missions checked in "Landing & Impact Sites" follow the same rule as the "Viable area" cards: all missions visible in the chart (legend / "All missions"), or only the filtered one when a filter is active; the globe frames the checked sites.
- On the globe (Canvas tab), hovering a point shows the site, the mission, the site's viability sum and the mission's "Viable area" (same value as the card). The mission with the largest area is green on the globe (Canvas and three.js) and in its checkbox.
- In "Landing & Impact Sites": viability sum (sum of the daily `VIABILITY` from 2024-01-01 to 2025-12-31) per site in the table and the total of the checked sites below the globe. It comes from `siteTotals`, generated by `node scripts/build-viability.mjs`.
- Section `#sites` (menu "Sites"): choose a mission (16 landing/impact sites) or check groups of simulated sites (`site/shared/data/dLandingSites.csv`, multiple choice) and the globe spins and frames all the points (autoscale). Four versions in tabs: Canvas (no dependency), three.js (loaded only when the tab opens), Moon3DMap (iframe, needs internet) and Terrain 3D (Apollo landing sites in relief). Everything except Moon3DMap works offline.

### Intro and closing videos

Two video sections (`site/shared/videos.js`, muted, no audio, 5 s each):
- `#intro`, above `#home`: `site/shared/media/hook_newspaper.mp4` ("The Lunar Gazette" hook).
- `#closing`, after `#about`: `site/shared/media/closing_moonwatch.mp4` (extra edition with the MoonWatch logo); it stops at 4.5 s, before its fade to dark.

Each one plays once when its section is at least half on screen and stops on its last frame; Stop / Play button (Play replays it). With reduced motion they do not autoplay and show the poster.

Sources: `python3 docs/video/hook_newspaper.py docs/video/hook_newspaper.mp4` and `python3 docs/video/closing_moonwatch.py docs/video/closing_moonwatch.mp4` (fonts SIL OFL in `docs/video/fonts/`, logo in `docs/video/assets/`; rendered mp4s are not versioned). Web copies and posters (`NAME` = `hook_newspaper` or `closing_moonwatch`; poster at `-sseof -0.1` for the hook, `-ss 4.5` for the closing):

```
ffmpeg -i docs/video/NAME.mp4 -vf scale=1280:-2 -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an site/shared/media/NAME.mp4
ffmpeg -sseof -0.1 -i docs/video/NAME.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 4 site/shared/media/NAME.jpg
```

`scripts/serve.mjs` answers HTTP byte ranges: without them the browser cannot seek inside a video.

### NASA assets (vendored, public domain)

| Tab | Asset | Source |
|---|---|---|
| Canvas | LRO WAC global mosaic, 128 tiles stitched into 4096×2048 (`site/shared/vendor/nasa/moontrek/`); fallback: CGI Moon Kit 2k (`moon-2k.jpg`) | [NASA Moon Trek](https://trek.nasa.gov/moon/), [SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) |
| three.js | `moon_small.glb` (LRO color + topography) | [NASA SVS 14959](https://svs.gsfc.nasa.gov/14959/) |
| Terrain 3D | Apollo 11/12/14/15/16 landing-site height maps (STL, 30×30 km, height ×60) + Apollo Lunar Module (GLB, Draco) | [NASA 3D Resources](https://science.nasa.gov/3d-resources/), [GitHub](https://github.com/nasa/NASA-3D-Resources) |

three.js r158 runs as ES modules (import map in `site/chartjs/index.html`, `site/shared/vendor/three/`). Refresh every asset (~74 MB, overwrites the files): `node scripts/fetch-nasa-assets.mjs [--zoom 3]`. Sources and sizes: `site/shared/vendor/nasa/SOURCES.md`.
- Libraries live in `site/chartjs/vendor/`; works offline (only the Moon3DMap tab needs internet; Google Fonts fall back to system fonts).

### Database (SQLite)

```bash
node scripts/build-db.mjs   # builds data/moonwatch.sqlite (git-ignored) from the 2 CSVs
```

Star schema, built with Node 22 native `node:sqlite` (no dependency):

| Table/view | Source | Key |
|---|---|---|
| `d_landing_sites` (id, name, lat, long, mission_id, prs_id, nearest_cold) | `site/shared/data/dLandingSites.csv` | `id` |
| `f_viability` (landing_site_id, date, viability) | `docs/fLandingSites_viability.csv` | (`landing_site_id`, `date`); `landing_site_id` → `d_landing_sites.id` |
| `v_viability` | join of the two | — |

The build validates headers, numbers, dates and foreign keys, and loads everything in one transaction (if anything fails, no half-built database is left).

Structure: everything that is not chart-specific (data, filter, table, guide lines, layout, CSS) lives in `site/shared/`; `site/chartjs/chart.js` is the Chart.js adapter. Plan and decisions: [`docs/PLAN.md`](docs/PLAN.md).

About the Challenge
https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

Missions to the Moon’s south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.

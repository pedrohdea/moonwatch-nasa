// E2E check of the 3 variants via Chrome DevTools Protocol (Node 22 global WebSocket).
// Usage: ./scripts/serve.sh &  google-chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank &  node tests/e2e.mjs   (W=390 for mobile width)
const PORTS = { chartjs: 8003 };
const WIDTH = Number(process.env.W || 1280);
const DATASETS = (process.env.DATASETS || 'curvas,sarah').split(',');
const SEED = process.env.SEED || 424242; // fixed random accuracy so runs are reproducible
const VIZS = (process.env.VIZ || 'cor,faixa,rotulo').split(',');

// In-page helpers working on MoonSeries data (normalized to the dataset ranges), so any dataset can be tested.
// Handle (arrow) center = right end of the plot area + HANDLE_DX px. Filled in from each adapter's report.
const HANDLE_DX = { chartjs: 6 };
// Toggle series k through each library's legend path (Chart.js needs a real click on the legend item).
const LEGEND_TOGGLE = {
  chartjs: `(k)=>{const cv=document.querySelector('#chart canvas');const c=Chart.getChart(cv);const b=c.legend.legendHitBoxes[c.legend.legendItems.findIndex(it=>it.datasetIndex===k)];const r=cv.getBoundingClientRect();return [r.left+b.left+b.width/2,r.top+b.top+b.height/2];}`,
};
// Number of datasets drawn by the chart library.
const VISIBLE_DATASETS = {
  chartjs: `()=>{const c=Chart.getChart(document.querySelector('#chart canvas'));return c.data.datasets.filter((_,i)=>c.isDatasetVisible(i)).length;}`,
};
// Visible x range per library (to prove dragging the line did not zoom).
const XVIEW = {
  chartjs: `()=>{const c=Chart.getChart(document.querySelector('#chart canvas'));return [c.scales.x.min,c.scales.x.max];}`,
};

// Lines are straight segments between table points, so the helpers interpolate 8 samples per segment.
const NORM = `const d=MoonSeries.dataset,nx=x=>(x-d.xRange[0])/(d.xRange[1]-d.xRange[0]),ny=y=>(y-d.yRange[0])/(d.yRange[1]-d.yRange[0]),gx=9/document.getElementById('chart').clientWidth,gy=9/document.getElementById('chart').clientHeight,nearGuide=(a,b)=>MoonCore.hlines.list().some(l=>Math.abs(b-ny(l.value))<gy)||MoonCore.vlines.list().some(l=>Math.abs(a-nx(l.value))<gx),dense=s=>s.points.flatMap((p,k,a)=>k===0?[p]:Array.from({length:8},(_,j)=>[a[k-1][0]+(p[0]-a[k-1][0])*(j+1)/8,a[k-1][1]+(p[1]-a[k-1][1])*(j+1)/8]));`;
// Spot on series s farthest from every other series (avoids the edges, where legends/toolbars sit). Returns [x, y, distance].
const ISOLATED = `(s)=>{${NORM}const me=dense(MoonSeries.all[s]),others=MoonSeries.all.filter((_,i)=>i!==s).flatMap(dense);let best=null,bd=-1;for(const[x,y]of me){const a=nx(x),b=ny(y);if(a<0.08||a>0.92||b<0.08||b>0.92||nearGuide(a,b))continue;let m=1e9;for(const[ox,oy]of others){const dd=(nx(ox)-a)**2+(ny(oy)-b)**2;if(dd<m)m=dd}if(m>bd){bd=m;best=[x,y,Math.sqrt(m)]}}return best||[...me[Math.floor(me.length/2)].slice(0,2),0];}`;
// Spot inside the plot farthest from every line.
const EMPTY = `()=>{${NORM}const pts=MoonSeries.all.flatMap(dense);let best=null,bd=-1;for(let i=1;i<20;i++)for(let j=1;j<20;j++){const a=0.1+0.8*i/20,b=0.1+0.8*j/20;if(nearGuide(a,b))continue;let m=1e9;for(const[ox,oy]of pts){const dd=(nx(ox)-a)**2+(ny(oy)-b)**2;if(dd<m)m=dd}if(m>bd){bd=m;best=[d.xRange[0]+a*(d.xRange[1]-d.xRange[0]),d.yRange[0]+b*(d.yRange[1]-d.yRange[0]),Math.sqrt(m)]}}return best;}`;

// Returns page-relative pixel of data point (x, y) for series s, using each lib's API.
const PIXEL = {
  chartjs: `(s,x,y)=>{const cv=document.querySelector('#chart canvas');const c=Chart.getChart(cv);const r=cv.getBoundingClientRect();return [r.left+c.scales.x.getPixelForValue(x),r.top+c.scales.y.getPixelForValue(y)];}`,
};

async function main() {
  const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result.value;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  const click = async (x, y) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await wait(300); };
  const badge = () => evaluate(`document.getElementById('filter-badge').textContent`);

  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: WIDTH < 500 });
  let failed = 0;
  const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`); };

  for (const dataset of DATASETS) for (const viz of VIZS) for (const [lib, port] of Object.entries(PORTS)) {
    errors.length = 0;
    console.log(`${lib} (:${port}) dataset=${dataset} viz=${viz} width=${WIDTH}`);
    await send('Page.navigate', { url: `http://localhost:${port}/?dataset=${dataset}&viz=${viz}&seed=${SEED}#track` });
    await wait(2500);
    await evaluate(`document.getElementById('chart').scrollIntoView({block:'center'})`);
    await wait(400);
    const px = (s, x, y) => evaluate(`(${PIXEL[lib]})(${s},${x},${y})`);
    const series = await evaluate(`MoonSeries.all.map(s=>s.name)`);
    const MoonSeriesKind = await evaluate(`MoonSeries.dataset.kind`);
    const [first, second] = MoonSeriesKind === 'spurious' ? [1, 0] : [18, 1];
    const isolation = async (s) => (await evaluate(`(${ISOLATED})(${s})`))[2];
    const pointOn = async (s) => { const [x, y] = await evaluate(`(${ISOLATED})(${s})`); return px(s, x, y); };
    const skip = (name, why) => console.log(`  SKIP ${name} (${why})`);
    // Lines closer than ~16px on screen are ambiguous for any 12px click tolerance.
    const AMBIGUOUS = 16 / await evaluate(`document.getElementById('chart').clientWidth`);
    // null when every candidate spot is next to a draggable guide line (crowded phone view).
    const emptySpot = async () => { const e = await evaluate(`(${EMPTY})()`); return e ? px(0, e[0], e[1]) : null; };

    check('no chart error', !(await evaluate(`!!document.querySelector('.chart-error')`)));
    check('initial badge', (await badge()).startsWith('Todas'), await badge());

    if (await isolation(first) < AMBIGUOUS) {
      skip(`click line filters ${series[first]}`, 'lines overlap; filtering through MoonCore');
      await evaluate(`MoonCore.setFilter(${first})`); await wait(300);
    } else {
      const [sx, sy] = await pointOn(first);
      await click(sx, sy);
      const b1 = await badge();
      check(`click line filters ${series[first]}`, b1.includes(series[first]), b1);
    }
    check('table shows only that series', await evaluate(MoonSeriesKind === 'spurious'
      ? `(()=>{const h=document.getElementById('table-head').textContent;return h.includes(${JSON.stringify(series[first])})&&!h.includes(${JSON.stringify(series[second === first ? 0 : second])})})()`
      : `[...document.querySelectorAll('#table-body tr')].every(t=>t.children[1].textContent===${JSON.stringify(series[first])})`));

    check('table accuracy belongs to the filtered series', await evaluate(`(()=>{const want=MoonSeries.all[${first}].points.map(p=>p[3]+'%');const got=[...document.querySelectorAll('#table-body .acc')].map(e=>e.textContent);return got.length>0&&got.every((t,i)=>t===want[i]);})()`));

    const spot = await emptySpot();
    if (!spot) skip('drag keeps filter', 'no free spot away from guide lines');
    else {
      const [ex, ey] = spot;
      await mouse('mouseMoved', ex, ey); await mouse('mousePressed', ex, ey);
      await mouse('mouseMoved', ex + 120, ey + 60); await mouse('mouseReleased', ex + 120, ey + 60); await wait(400);
      check('drag keeps filter', (await badge()).includes(series[first]), await badge());
    }
    await evaluate(`document.getElementById('reset-zoom').click()`);
    await wait(400);

    const emptyDist = ((await evaluate(`(${EMPTY})()`)) || [0, 0, 0])[2];
    if (emptyDist < AMBIGUOUS) {
      skip('empty click clears', 'no empty spot far enough from lines and guides');
      await evaluate(`document.getElementById('clear-filter').click()`); await wait(200);
    } else {
      const [ex2, ey2] = await emptySpot();
      await click(ex2, ey2);
      check('empty click clears', (await badge()).startsWith('Todas'), await badge());
    }

    if (await isolation(second) < AMBIGUOUS) skip(`click ${series[second]}`, 'lines overlap');
    else {
      const [qx, qy] = await pointOn(second);
      await click(qx, qy);
      check(`click ${series[second]}`, (await badge()).includes(series[second]), await badge());
    }
    await evaluate(`document.getElementById('clear-filter').click()`); await wait(200);
    check('clear button', (await badge()).startsWith('Todas'));

    // Draggable horizontal line: press on the arrow handle, drag to y=2, release.
    await evaluate(`MoonCore.setFilter(${first})`); await wait(300);
    const lineStart = await evaluate(`MoonCore.hlines.list()[0].value`); // drag H1 by its ◀ handle
    const d = await evaluate(`MoonSeries.dataset`);
    const [rx, ry] = await px(0, d.xRange[1], lineStart);
    const target = 2;
    const [, ty] = await px(0, d.xRange[1], target);
    const hx = rx + HANDLE_DX[lib];
    await mouse('mouseMoved', hx, ry); await mouse('mousePressed', hx, ry);
    for (let k = 1; k <= 6; k++) await mouse('mouseMoved', hx, ry + ((ty - ry) * k) / 6);
    await mouse('mouseReleased', hx, ty); await wait(400);
    const lineEnd = await evaluate(`MoonCore.hlines.list()[0].value`);
    check('drag arrow moves the line', Math.abs(lineEnd - target) <= 0.25, `${lineStart} -> ${lineEnd}`);
    check('H1 chip follows the line', Math.abs(Number(await evaluate(`document.querySelector('#hlines-list .vline-chip input').value`)) - lineEnd) < 1e-9);
    check('line drag keeps the filter', (await badge()).includes(series[first]), await badge());
    const [zx0, zx1] = await evaluate(`(${XVIEW[lib]})()`);
    const span = d.xRange[1] - d.xRange[0];
    check('line drag does not zoom', Math.abs(zx0 - d.xRange[0]) < span * 0.01 && Math.abs(zx1 - d.xRange[1]) < span * 0.01, `${zx0}..${zx1}`);
    // Typed value must move the drawn handle: drag again from the typed position.
    // Type a value away from the other handles (top of the y range) so the press can only hit H1.
    await evaluate(`MoonCore.hlines.set(MoonCore.hlines.list()[0].id,MoonCore.hlines.max,'input')`); await wait(300);
    const [, sy] = await px(0, d.xRange[1], d.yRange[1]);
    const [, ey8] = await px(0, d.xRange[1], 8);
    await mouse('mouseMoved', hx, sy); await mouse('mousePressed', hx, sy);
    for (let k = 1; k <= 6; k++) await mouse('mouseMoved', hx, sy + ((ey8 - sy) * k) / 6);
    await mouse('mouseReleased', hx, ey8); await wait(400);
    check('typed value moves the handle', Math.abs((await evaluate(`MoonCore.hlines.list()[0].value`)) - 8) <= 0.25, String(await evaluate(`MoonCore.hlines.list()[0].value`)));
    await evaluate(`document.getElementById('clear-filter').click()`); await wait(200);

    // Vertical lines: 3 by default, add/remove buttons, drag V1 by its ▼ handle (plot top − 8 px).
    const chips = () => evaluate(`document.querySelectorAll('#vlines-list .vline-chip').length`);
    const nSeries = series.length;
    const nLines = () => evaluate(`MoonCore.vlines.list().length`);
    check('one vertical line per series by default', (await nLines()) === nSeries && (await chips()) === nSeries, `${await nLines()} lines, ${nSeries} series`);
    check('add disabled at the series count', await evaluate(`document.getElementById('vline-add').disabled`));
    await evaluate(`[...document.querySelectorAll('#vlines-list .vline-remove')].pop().click()`); await wait(250);
    check('× removes a vertical line', (await nLines()) === nSeries - 1 && (await chips()) === nSeries - 1);
    await evaluate(`document.getElementById('vline-add').click()`); await wait(250);
    check('add button adds it back', (await nLines()) === nSeries && (await chips()) === nSeries);
    check('vertical line k has the color of series k', await evaluate(`MoonCore.vlines.list().every((_,k)=>MoonCore.vlineColor(k)===MoonSeries.colors[k])`));
    await evaluate(`MoonCore.setFilter(${first})`); await wait(300);
    // Put the plot top below the sticky top bar (3 rows on phones), instantly (page uses smooth scroll).
    await evaluate(`(()=>{const r=document.getElementById('chart').getBoundingClientRect();const bar=document.querySelector('.topbar').getBoundingClientRect().bottom;window.scrollTo({top:scrollY+r.top-bar-40,behavior:'instant'})})()`); await wait(300);
    const hBefore = await evaluate(`JSON.stringify(MoonCore.hlines.list())`);
    // A series filter shows only that series' travel-time line; drag that one (V of the filtered series).
    check('filter shows only its travel-time line', (await evaluate(`[...document.querySelectorAll('#vlines-list .vline-chip')].filter(e=>!e.hidden).length`)) === 1);
    const v1 = (await evaluate(`MoonCore.vlines.list()`))[first];
    const vTarget = v1.value - span * 0.15;
    const [vx, vtop] = await px(0, v1.value, d.yRange[1]);
    const [tx] = await px(0, vTarget, d.yRange[1]);
    const vy = vtop - 8;
    await mouse('mouseMoved', vx, vy); await mouse('mousePressed', vx, vy);
    for (let k = 1; k <= 6; k++) await mouse('mouseMoved', vx + ((tx - vx) * k) / 6, vy);
    await mouse('mouseReleased', tx, vy); await wait(400);
    const v1After = (await evaluate(`MoonCore.vlines.list()`))[first].value;
    check('drag ▼ moves vertical line', Math.abs(v1After - vTarget) <= Math.max(span * 0.02, 1), `${v1.value} -> ${v1After} (want ${vTarget})`);
    const depValue = await evaluate(`MoonCore.departure.list()[0].value`);
    check('chip shows the travel time from the departure', Math.abs(Number(await evaluate(`document.querySelector('#vlines-list .vline-chip:not([hidden]) input').value`)) - (v1After - depValue)) < 0.011);
    check('vertical drag keeps the filter', (await badge()).includes(series[first]), await badge());
    const [vz0, vz1] = await evaluate(`(${XVIEW[lib]})()`);
    check('vertical drag does not zoom', Math.abs(vz0 - d.xRange[0]) < span * 0.01 && Math.abs(vz1 - d.xRange[1]) < span * 0.01, `${vz0}..${vz1}`);
    check('vertical drag leaves the horizontal lines', (await evaluate(`JSON.stringify(MoonCore.hlines.list())`)) === hBefore);
    // Departure: dragging its ▼ moves every travel-time line by the same amount (travel times unchanged).
    await evaluate(`document.getElementById('clear-filter').click()`); await wait(200);
    const travelBefore = await evaluate(`JSON.stringify(MoonCore.vlines.list().map(l=>MoonCore.travelTime(l.id)))`);
    const posBefore = await evaluate(`MoonCore.vlines.list().map(l=>l.value)`);
    const [dx, dtop] = await px(0, depValue, d.yRange[1]);
    const depTarget = depValue + span * 0.05;
    const [dtx] = await px(0, depTarget, d.yRange[1]);
    await mouse('mouseMoved', dx, dtop - 8); await mouse('mousePressed', dx, dtop - 8);
    for (let k = 1; k <= 6; k++) await mouse('mouseMoved', dx + ((dtx - dx) * k) / 6, dtop - 8);
    await mouse('mouseReleased', dtx, dtop - 8); await wait(400);
    const depAfter = await evaluate(`MoonCore.departure.list()[0].value`);
    check('drag Partida moves the departure', Math.abs(depAfter - depTarget) <= Math.max(span * 0.02, 1), `${depValue} -> ${depAfter}`);
    check('travel times unchanged after moving the departure', (await evaluate(`JSON.stringify(MoonCore.vlines.list().map(l=>MoonCore.travelTime(l.id)))`)) === travelBefore);
    const posAfter = await evaluate(`MoonCore.vlines.list().map(l=>l.value)`);
    const shift = depAfter - depValue;
    check('every travel-time line shifted with the departure', posAfter.every((v, i) => Math.abs(v - Math.min(d.xRange[1], posBefore[i] + shift)) < 0.02), `shift ${shift}`);
    // Legend toggle: hiding series 0 removes its vertical line, chip and area card; showing it brings them back.
    const toggle = async () => {
      // Legend sits above the plot: bring the chart's top edge just below the sticky top bar first.
      await evaluate(`(()=>{const r=document.getElementById('chart').getBoundingClientRect();const bar=document.querySelector('.topbar').getBoundingClientRect().bottom;window.scrollTo({top:scrollY+r.top-bar-10,behavior:'instant'})})()`); await wait(200);
      const pt = await evaluate(`(${LEGEND_TOGGLE[lib]})(0)`); if (pt) await click(pt[0], pt[1]); await wait(500);
    };
    const shownChips = () => evaluate(`[...document.querySelectorAll('#vlines-list .vline-chip')].filter(e=>!e.hidden).length`);
    const cards = () => evaluate(`document.querySelectorAll('#fill-areas .fill-area').length`);
    await toggle();
    check('legend hide: series 0 reported hidden', (await evaluate(`MoonCore.isVisible(0)`)) === false);
    check('legend hide: one vertical line less', (await shownChips()) === nSeries - 1 && (await cards()) === nSeries - 1, `${await shownChips()} chips, ${await cards()} cards`);
    await toggle();
    check('legend show: lines back', (await evaluate(`MoonCore.isVisible(0)`)) === true && (await shownChips()) === nSeries && (await cards()) === nSeries);
    // "Todos os grupos" checkbox: unchecking hides every series (chart, travel-time chips, cards); checking shows all.
    const setAll = (v) => evaluate(`(b=>{b.checked=${v};b.dispatchEvent(new Event('change'))})(document.getElementById('all-series'))`);
    await setAll(false); await wait(400);
    check('uncheck all: nothing visible', (await evaluate(`MoonCore.visibleCount()`)) === 0 && (await shownChips()) === 0 && (await cards()) === 0 && (await evaluate(`(${VISIBLE_DATASETS[lib]})()`)) === 0);
    await setAll(true); await wait(400);
    check('check all: everything back', (await evaluate(`MoonCore.visibleCount()`)) === nSeries && (await shownChips()) === nSeries && (await evaluate(`(${VISIBLE_DATASETS[lib]})()`)) === nSeries);
    const areasMatch = `(()=>{const f=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});const want=MoonCore.areas().map(a=>f.format(a.area));const got=[...document.querySelectorAll('#fill-areas .fill-area strong')].map(e=>e.textContent);return got.length===want.length&&got.every((t,i)=>t===want[i]);})()`;
    check('filled areas shown per vertical line', await evaluate(areasMatch));
    const areaBefore = await evaluate(`document.querySelector('#fill-areas .fill-area strong')?.textContent`);
    await evaluate(`MoonCore.hlines.set(MoonCore.hlines.list()[0].id, MoonCore.hlines.min + (MoonCore.hlines.max - MoonCore.hlines.min) * 0.1, 'input')`); await wait(200);
    check('areas follow the horizontal line', (await evaluate(areasMatch)) && (await evaluate(`document.querySelector('#fill-areas .fill-area strong')?.textContent`)) !== areaBefore, String(areaBefore));
    await evaluate(`document.getElementById('clear-filter').click()`); await wait(200);

    const before = await evaluate(`document.querySelectorAll('#table-body tr').length`);
    for (let i = 0; i < 4; i++) { await evaluate(`(b=>b.scrollTop=b.scrollHeight)(document.getElementById('table-box'))`); await wait(250); }
    const after = await evaluate(`document.querySelectorAll('#table-body tr').length`);
    const totalRows = await evaluate(`MoonSeriesTotal=document.getElementById('filter-badge').textContent.match(/([\\d.]+) linhas/)[1].replace(/\\./g,'')*1`);
    check('infinite scroll loads more (or all rows fit)', after > before || after === totalRows, `${before} -> ${after} of ${totalRows}`);
    check('no horizontal page scroll', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`));
    check('no JS errors', errors.length === 0, errors.join(' | '));
  }

  // Switching dataset must drop the old ?vlinhas=/?linha= so the new dataset starts with one line per series.
  for (const [lib, port] of Object.entries(PORTS)) {
    console.log(`${lib} (:${port}) dataset switch width=${WIDTH}`);
    await send('Page.navigate', { url: `http://localhost:${port}/?dataset=sarah&vlinhas=1990,2000&minima=3&seed=${SEED}#track` });
    await wait(2000);
    await evaluate(`(s=>{s.value='curvas';s.dispatchEvent(new Event('change'))})(document.getElementById('dataset-select'))`);
    await wait(3000);
    const n = await evaluate(`MoonSeries.all.length`);
    check('switch to curvas: one vertical line per series', (await evaluate(`MoonCore.vlines.list().length`)) === n, `${await evaluate(`MoonCore.vlines.list().length`)} of ${n}`);
    check('switch to curvas: one minimum-viability line, back to the middle', (await evaluate(`MoonCore.hlines.list().length`)) === 1 && (await evaluate(`MoonCore.hlines.list()[0].value`)) === 5);
  }

  // #pouso globe: after picking a mission, Canvas and three.js views end centered on it (far side included).
  for (const [lib, port] of Object.entries(PORTS)) {
    errors.length = 0;
    console.log(`${lib} (:${port}) #pouso width=${WIDTH}`);
    await send('Page.navigate', { url: `http://localhost:${port}/?seed=${SEED}#pouso` });
    await wait(2500);
    await evaluate(`MoonLanding.ready`);
    const centered = (key) => evaluate(`(()=>{const m=MoonLanding.missions.find(x=>x.key==='${key}'),v=MoonLanding.state.view;return Math.abs(v.lat-m.lat)<1&&Math.abs(((v.lon-m.lon+540)%360)-180)<1})()`);
    await evaluate(`MoonLanding.select('apollo-11-landing-site')`); await wait(3000);
    check('canvas centers on Apollo 11', await centered('apollo-11-landing-site'));
    await evaluate(`MoonLanding.setTab('three')`); await wait(1500);
    await evaluate(`MoonLanding.select('change-4-landing-site')`); await wait(3000);
    check("three.js centers on Chang'e 4 (far side)", await centered('change-4-landing-site'));
    await evaluate(`document.querySelector('#landing-group-list input[value="csv-1"]').click()`);
    await evaluate(`document.querySelector('#landing-group-list input[value="csv-10"]').click()`); await wait(3000);
    const framed = await evaluate(`(()=>{const v=MoonLanding.state.view,M=MoonLanding.math;return MoonLanding.state.groups.filter(g=>MoonLanding.state.checked.includes(g.key)).flatMap(g=>g.points).every(p=>{const s=M.latLonToScreen(p.lat,p.lon,v);return v.zoom===1||(s.visible&&Math.hypot(s.x,s.y)*0.46*v.zoom<=0.41)})})()`);
    check('multi-select groups 1+10 frames all 10 points and lists them', framed && (await evaluate(`document.querySelectorAll('#landing-points tbody tr').length`)) === 10);
    await evaluate(`MoonLanding.select('change-4-landing-site')`); await wait(3000);
    check('three.js canvas drawn', await evaluate(`!!document.querySelector('[data-pane=three] canvas')`));
    await evaluate(`MoonLanding.setTab('iframe')`); await wait(300);
    check('iframe gets mission URL', (await evaluate(`document.querySelector('[data-pane=iframe]').src`)).includes('change-4-landing-site'));
    check('no horizontal page scroll', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`));
    check('no JS errors', errors.length === 0, errors.join(' | '));
  }
  ws.close();
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });

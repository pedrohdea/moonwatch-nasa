// E2E check of the 3 variants via Chrome DevTools Protocol (Node 22 global WebSocket).
// Usage: ./scripts/serve.sh &  google-chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank &  node tests/e2e.mjs   (W=390 for mobile width)
const PORTS = { echarts: 8001, plotly: 8002, chartjs: 8003 };
const WIDTH = Number(process.env.W || 1280);
const DATASETS = (process.env.DATASETS || 'curvas,sarah').split(',');

// In-page helpers working on MoonSeries data (normalized to the dataset ranges), so any dataset can be tested.
// Lines are straight segments between table points, so the helpers interpolate 8 samples per segment.
const NORM = `const d=MoonSeries.dataset,nx=x=>(x-d.xRange[0])/(d.xRange[1]-d.xRange[0]),ny=y=>(y-d.yRange[0])/(d.yRange[1]-d.yRange[0]),dense=s=>s.points.flatMap((p,k,a)=>k===0?[p]:Array.from({length:8},(_,j)=>[a[k-1][0]+(p[0]-a[k-1][0])*(j+1)/8,a[k-1][1]+(p[1]-a[k-1][1])*(j+1)/8]));`;
// Spot on series s farthest from every other series (avoids the edges, where legends/toolbars sit). Returns [x, y, distance].
const ISOLATED = `(s)=>{${NORM}const me=dense(MoonSeries.all[s]),others=MoonSeries.all.filter((_,i)=>i!==s).flatMap(dense);let best=null,bd=-1;for(const[x,y]of me){const a=nx(x),b=ny(y);if(a<0.08||a>0.92||b<0.08||b>0.92)continue;let m=1e9;for(const[ox,oy]of others){const dd=(nx(ox)-a)**2+(ny(oy)-b)**2;if(dd<m)m=dd}if(m>bd){bd=m;best=[x,y,Math.sqrt(m)]}}return best||[...me[Math.floor(me.length/2)].slice(0,2),0];}`;
// Spot inside the plot farthest from every line.
const EMPTY = `()=>{${NORM}const pts=MoonSeries.all.flatMap(dense);let best=null,bd=-1;for(let i=1;i<20;i++)for(let j=1;j<20;j++){const a=0.1+0.8*i/20,b=0.1+0.8*j/20;let m=1e9;for(const[ox,oy]of pts){const dd=(nx(ox)-a)**2+(ny(oy)-b)**2;if(dd<m)m=dd}if(m>bd){bd=m;best=[d.xRange[0]+a*(d.xRange[1]-d.xRange[0]),d.yRange[0]+b*(d.yRange[1]-d.yRange[0])]}}return best;}`;

// Returns page-relative pixel of data point (x, y) for series s, using each lib's API.
const PIXEL = {
  echarts: `(s,x,y)=>{const el=document.getElementById('chart');const c=echarts.getInstanceByDom(el)||echarts.getInstanceByDom(el.firstElementChild);const p=c.convertToPixel({seriesIndex:s},[x,y]);const r=c.getDom().getBoundingClientRect();return [r.left+p[0],r.top+p[1]];}`,
  plotly: `(s,x,y)=>{const gd=document.querySelector('.js-plotly-plot');const L=gd._fullLayout;const r=gd.getBoundingClientRect();return [r.left+L._size.l+L.xaxis.l2p(x),r.top+L._size.t+L.yaxis.l2p(y)];}`,
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

  for (const dataset of DATASETS) for (const [lib, port] of Object.entries(PORTS)) {
    errors.length = 0;
    console.log(`${lib} (:${port}) dataset=${dataset} width=${WIDTH}`);
    await send('Page.navigate', { url: `http://localhost:${port}/?dataset=${dataset}#track` });
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
    const AMBIGUOUS = 0.03; // normalized distance: lines closer than this overlap on screen
    const emptySpot = async () => { const [x, y] = await evaluate(`(${EMPTY})()`); return px(0, x, y); };

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

    const [ex, ey] = await emptySpot();
    await mouse('mouseMoved', ex, ey); await mouse('mousePressed', ex, ey);
    await mouse('mouseMoved', ex + 120, ey + 60); await mouse('mouseReleased', ex + 120, ey + 60); await wait(400);
    check('drag keeps filter', (await badge()).includes(series[first]), await badge());
    await evaluate(`document.getElementById('reset-zoom').click()`);
    await wait(400);

    const [ex2, ey2] = await emptySpot();
    await click(ex2, ey2);
    check('empty click clears', (await badge()).startsWith('Todas'), await badge());

    if (await isolation(second) < AMBIGUOUS) skip(`click ${series[second]}`, 'lines overlap');
    else {
      const [qx, qy] = await pointOn(second);
      await click(qx, qy);
      check(`click ${series[second]}`, (await badge()).includes(series[second]), await badge());
    }
    await evaluate(`document.getElementById('clear-filter').click()`); await wait(200);
    check('clear button', (await badge()).startsWith('Todas'));

    const before = await evaluate(`document.querySelectorAll('#table-body tr').length`);
    for (let i = 0; i < 4; i++) { await evaluate(`(b=>b.scrollTop=b.scrollHeight)(document.getElementById('table-box'))`); await wait(250); }
    const after = await evaluate(`document.querySelectorAll('#table-body tr').length`);
    const totalRows = await evaluate(`MoonSeriesTotal=document.getElementById('filter-badge').textContent.match(/([\\d.]+) linhas/)[1].replace(/\\./g,'')*1`);
    check('infinite scroll loads more (or all rows fit)', after > before || after === totalRows, `${before} -> ${after} of ${totalRows}`);
    check('no horizontal page scroll', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`));
    check('no JS errors', errors.length === 0, errors.join(' | '));
  }
  ws.close();
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });

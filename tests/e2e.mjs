// E2E check of the 3 variants via Chrome DevTools Protocol (Node 22 global WebSocket).
// Usage: ./scripts/serve.sh &  google-chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mw-e2e about:blank &  node tests/e2e.mjs   (W=390 for mobile width)
const PORTS = { echarts: 8001, plotly: 8002, chartjs: 8003 };
const WIDTH = Number(process.env.W || 1280);

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

  for (const [lib, port] of Object.entries(PORTS)) {
    errors.length = 0;
    console.log(`${lib} (:${port}) width=${WIDTH}`);
    await send('Page.navigate', { url: `http://localhost:${port}/#track` });
    await wait(2500);
    await evaluate(`document.getElementById('chart').scrollIntoView({block:'center'})`);
    await wait(400);
    const px = (s, x, y) => evaluate(`(${PIXEL[lib]})(${s},${x},${y})`);

    check('no chart error', !(await evaluate(`!!document.querySelector('.chart-error')`)));
    check('initial badge', (await badge()).startsWith('Todas'), await badge());

    const [sx, sy] = await px(5, 4.5, 5 + 5 * Math.sin(4.5)); // on Senoidal, far from other curves
    await click(sx, sy);
    const b1 = await badge();
    check('click line filters Senoidal', b1.includes('Senoidal') && b1.includes('2.001'), b1);
    check('table rows only Senoidal', await evaluate(`[...document.querySelectorAll('#table-body tr')].every(t=>t.children[1].textContent==='Senoidal')`));

    const [ex, ey] = await px(0, 9.5, 1); // empty area
    await mouse('mouseMoved', ex, ey); await mouse('mousePressed', ex, ey);
    await mouse('mouseMoved', ex + 120, ey + 60); await mouse('mouseReleased', ex + 120, ey + 60); await wait(400);
    check('drag keeps filter', (await badge()).includes('Senoidal'), await badge());
    if (lib !== 'plotly') await evaluate(`document.getElementById('reset-zoom').click()`);
    else await evaluate(`document.getElementById('reset-zoom').click()`);
    await wait(400);

    const [ex2, ey2] = await px(0, 9.5, 1);
    await click(ex2, ey2);
    check('empty click clears', (await badge()).startsWith('Todas'), await badge());

    const [qx, qy] = await px(1, 8, 6.4); // on Quadrática
    await click(qx, qy);
    check('click Quadrática', (await badge()).includes('Quadrática'), await badge());
    await evaluate(`document.getElementById('clear-filter').click()`); await wait(200);
    check('clear button', (await badge()).startsWith('Todas'));

    const before = await evaluate(`document.querySelectorAll('#table-body tr').length`);
    for (let i = 0; i < 4; i++) { await evaluate(`(b=>b.scrollTop=b.scrollHeight)(document.getElementById('table-box'))`); await wait(250); }
    const after = await evaluate(`document.querySelectorAll('#table-body tr').length`);
    check('infinite scroll loads more', after > before, `${before} -> ${after}`);
    check('no horizontal page scroll', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`));
    check('no JS errors', errors.length === 0, errors.join(' | '));
  }
  ws.close();
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });

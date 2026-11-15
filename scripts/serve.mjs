// Static server for the MoonWatch site (Chart.js) on :8003 (or --port N / PORT=N).
// Sends Cache-Control: no-store so edits to site/shared/ are never hidden by a stale browser cache.
// Usage: node scripts/serve.mjs [--port 8003]   (Ctrl+C stops)
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(fileURLToPath(import.meta.url), '../../site');
const SHARED = join(SITE, 'shared');
const pi = process.argv.indexOf('--port');
const PORT = Number(pi > 0 ? process.argv[pi + 1] : process.env.PORT) || 8003;
const VARIANTS = { chartjs: PORT };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };

for (const [dir, port] of Object.entries(VARIANTS)) {
  const root = join(SITE, dir);
  createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const path = normalize(pathname);
    if (path.split(sep).includes('..')) { res.writeHead(400).end(); return; } // reject traversal
    // /shared/* is served from site/shared directly: the site/<variant>/shared symlink is not checked out as a link on Windows.
    let file = pathname.startsWith('/shared/') ? join(SHARED, normalize(pathname.slice('/shared/'.length))) : join(root, path);
    if (!resolve(file).startsWith(SITE + sep)) { res.writeHead(400).end(); return; } // never serve outside site/
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      statSync(file);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    // Byte ranges: browsers need them to seek in <video> (without them the media is not seekable).
    const size = statSync(file).size;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': size });
    createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`${dir} -> http://localhost:${port}/`));
}

// Static server for the MoonWatch site (Chart.js) on :8003.
// Sends Cache-Control: no-store so edits to site/shared/ are never hidden by a stale browser cache.
// Usage: node scripts/serve.mjs   (Ctrl+C stops all)
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(fileURLToPath(import.meta.url), '../../site');
const VARIANTS = { chartjs: 8003 };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

for (const [dir, port] of Object.entries(VARIANTS)) {
  const root = join(SITE, dir);
  createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    // Reject traversal; the `shared` symlink inside each variant is followed by the filesystem.
    if (path.split(sep).includes('..')) { res.writeHead(400).end(); return; }
    let file = join(root, path);
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      statSync(file);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`${dir} -> http://localhost:${port}/`));
}

import http from 'node:http';
import fs from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '127.0.0.1';
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};
http
  .createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const entry = await stat(file);
      const target = entry.isDirectory() ? path.join(file, 'index.html') : file;
      const info = await stat(target);
      if (!info.isFile()) throw new Error('Not a file');
      res.writeHead(200, {
        'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Length': info.size,
      });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(port, host, () => console.log(`Pal Pop: http://${host}:${port}/`));

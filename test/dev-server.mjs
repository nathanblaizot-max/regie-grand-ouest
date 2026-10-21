// Serveur local de test : sert public/ et relie /api/* à core.mjs avec la base simulée.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handle } from '../netlify/lib/core.mjs';
import { makeFakeDb } from './fake-db.mjs';

export function startServer(port = 0, withBlobs = true, quotaMb) {
  const db = makeFakeDb();
  const files = new Map();
  const submissions = []; // formulaires envoyés en POST sur « / » (comme Netlify Forms)
  const blobs = withBlobs ? { set: async (k, v) => void files.set(k, v), get: async (k) => (files.has(k) ? files.get(k) : null), delete: async (k) => void files.delete(k) } : undefined;
  const pub = path.resolve(new URL('../public', import.meta.url).pathname);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer(async (req, res) => {
    const origin = 'http://' + req.headers.host;
    if (req.url.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const r = new Request(origin + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const out = await handle(r, db, { setupCode: 'TESTCODE', bbbToken: 'TOKEN_DE_TEST_0123456789abcdef', blobs, quotaMb });
      const headers = {}; out.headers.forEach((v, k) => (headers[k] = v));
      res.writeHead(out.status, headers); res.end(Buffer.from(await out.arrayBuffer())); return;
    }
    if (req.method === 'POST' && req.url === '/') { const ch = []; for await (const c of req) ch.push(c); submissions.push(Object.fromEntries(new URLSearchParams(Buffer.concat(ch).toString()))); res.writeHead(200); res.end('ok'); return; }
    let file = path.join(pub, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html'; // comme les URLs propres de Netlify
    if (!file.startsWith(pub) || !fs.existsSync(file)) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, db, files, submissions, port: server.address().port })));
}

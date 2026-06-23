import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import chokidar from 'chokidar';
import open from 'open';
import { parsePlan } from './parser.js';
import { phasesToMermaid, buildPipeline } from './flow.js';
import { deriveStats, deriveCommands, deriveDeps } from './derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(__dirname, '..', 'web');

function buildModel(file) {
  const md = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const model = parsePlan(md);
  const deps = deriveDeps(model);
  const { commands, commits } = deriveCommands(model);
  const pipeline = buildPipeline(model.phases, model.tasks)
    .map(n => ({ ...n, deps: deps[n.title] || [] }));
  return {
    ...model,
    flow: phasesToMermaid(model.phases),
    pipeline,
    stats: deriveStats(model),
    commands,
    commits,
  };
}

function serveStatic(name, type, res) {
  const p = path.join(WEB, name);
  if (existsSync(p)) {
    res.writeHead(200, { 'content-type': type });
    res.end(readFileSync(p));
  } else {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><meta charset=utf8><title>plangy</title><p>Loading… (web assets pending)');
  }
}

export function startServer({ file, port = 7331, openBrowser = true }) {
  const clients = new Set();

  const server = http.createServer((req, res) => {
    if (req.url === '/' ) return serveStatic('app.html', 'text/html', res);
    if (req.url === '/app.js') return serveStatic('app.js', 'text/javascript', res);
    if (req.url === '/app.css') return serveStatic('app.css', 'text/css', res);
    if (req.url === '/mermaid.min.js') return serveStatic('mermaid.min.js', 'text/javascript', res);
    if (req.url === '/model') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(buildModel(file)));
    }
    if (req.url === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write('event: ping\ndata: {}\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  const watcher = chokidar.watch(file, { ignoreInitial: true });
  watcher.on('all', () => {
    for (const c of clients) c.write('event: update\ndata: {}\n\n');
  });

  return new Promise((resolve) => {
    const tryListen = (p, attempts = 0) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempts < 20) tryListen(p + 1, attempts + 1);
        else throw err;
      });
      server.listen(p, '127.0.0.1', () => {
        const actual = server.address().port;
        const url = `http://127.0.0.1:${actual}`;
        if (openBrowser) open(url).catch(() => {});
        resolve({
          url,
          close: () => new Promise((r) => { watcher.close(); for (const c of clients) c.end(); server.close(r); }),
        });
      });
    };
    tryListen(Number(port));
  });
}

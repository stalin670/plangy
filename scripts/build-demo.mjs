// Render examples/plan.md into a single static docs/index.html (GitHub Pages demo).
// Inlines the model, CSS, and JS; loads mermaid from a CDN (the demo is online).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { composeModel } from '../src/model.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const p = (...x) => path.join(root, ...x);

const md = readFileSync(p('examples', 'plan.md'), 'utf8');
const boot = { files: [{ i: 0, name: 'plan.md' }], model: composeModel(md, 'plan.md'), raw: md };

const css = readFileSync(p('web', 'app.css'), 'utf8');
const js = readFileSync(p('web', 'app.js'), 'utf8');
let html = readFileSync(p('web', 'app.html'), 'utf8');

// escape "<" so inlined JSON/JS can never break out of the <script> tag
const safe = (s) => JSON.stringify(s).replace(/</g, '\\u003c');

html = html
  .replace('<link rel="stylesheet" href="/app.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="/mermaid.min.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>')
  .replace('<script src="/app.js"></script>', `<script>window.__PLANGY_BOOT__=${safe(boot)};</script>\n<script>\n${js}\n</script>`);

mkdirSync(p('docs'), { recursive: true });
writeFileSync(p('docs', 'index.html'), html);
console.log(`wrote docs/index.html (${html.length} bytes)`);

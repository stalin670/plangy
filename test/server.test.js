import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('serves parsed model as json', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'plangy-'));
  const file = path.join(dir, 'plan.md');
  writeFileSync(file, '# Setup\n1. Install');
  const srv = await startServer({ file, port: 0, openBrowser: false });
  const res = await fetch(`${srv.url}/model`);
  const model = await res.json();
  assert.equal(model.phases[0].title, 'Setup');
  assert.match(model.flow, /flowchart TB/);
  assert.equal(model.pipeline[0].title, 'Setup');
  const raw = await fetch(`${srv.url}/raw`).then(r => r.text());
  assert.match(raw, /# Setup/);
  await srv.close();
});

test('serves multiple files with a switcher and per-file models', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'plangy-multi-'));
  const a = path.join(dir, 'a.md');
  const b = path.join(dir, 'b.md');
  writeFileSync(a, '# Alpha\n1. x');
  writeFileSync(b, '# Beta\n1. y');
  const srv = await startServer({ files: [a, b], port: 0, openBrowser: false });
  const files = await fetch(`${srv.url}/files`).then(r => r.json());
  assert.deepEqual(files.map(f => f.name), ['a.md', 'b.md']);
  const m0 = await fetch(`${srv.url}/model?i=0`).then(r => r.json());
  const m1 = await fetch(`${srv.url}/model?i=1`).then(r => r.json());
  assert.equal(m0.phases[0].title, 'Alpha');
  assert.equal(m1.phases[0].title, 'Beta');
  await srv.close();
});

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

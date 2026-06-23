import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const web = (f) => path.join(__dirname, '..', 'web', f);

test('web assets exist', () => {
  for (const f of ['app.html', 'app.css', 'app.js', 'mermaid.min.js']) {
    assert.ok(existsSync(web(f)), `${f} missing`);
  }
});

test('app.js fetches model and listens to events', () => {
  const js = readFileSync(web('app.js'), 'utf8');
  assert.match(js, /fetch\([`'"]\/model/);
  assert.match(js, /EventSource\(['"]\/events['"]\)/);
});

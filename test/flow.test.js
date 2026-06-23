import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phasesToMermaid } from '../src/flow.js';

test('builds sequential flowchart from phases', () => {
  const out = phasesToMermaid([
    { id: 'p0', title: 'Setup', steps: [] },
    { id: 'p1', title: 'Build', steps: [] },
  ]);
  assert.match(out, /^flowchart LR/);
  assert.match(out, /p0\["Setup"\]/);
  assert.match(out, /p1\["Build"\]/);
  assert.match(out, /p0 --> p1/);
});

test('empty phases returns placeholder', () => {
  assert.match(phasesToMermaid([]), /No phases/);
});

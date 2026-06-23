import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phasesToMermaid } from '../src/flow.js';

test('builds sequential flowchart from phases', () => {
  const out = phasesToMermaid([
    { id: 'p0', title: 'Setup', depth: 1, steps: [] },
    { id: 'p1', title: 'Build', depth: 1, steps: [] },
  ]);
  assert.match(out, /^flowchart TB/);
  assert.match(out, /p0\["Setup"\]/);
  assert.match(out, /p1\["Build"\]/);
  assert.match(out, /p0 --> p1/);
});

test('selects the dominant heading depth as the pipeline', () => {
  const out = phasesToMermaid([
    { id: 'p0', title: 'Plan', depth: 1, steps: [] },
    { id: 'p1', title: 'Task A', depth: 3, steps: [] },
    { id: 'p2', title: 'Task B', depth: 3, steps: [] },
    { id: 'p3', title: 'Task C', depth: 3, steps: [] },
    { id: 'p4', title: 'Wrapup', depth: 2, steps: [] },
  ]);
  // depth 3 is most frequent → only the three tasks become nodes
  assert.match(out, /p1\["Task A"\]/);
  assert.match(out, /p1 --> p2/);
  assert.match(out, /p2 --> p3/);
  assert.doesNotMatch(out, /p0\[/);
  assert.doesNotMatch(out, /p4\[/);
});

test('empty phases returns placeholder', () => {
  assert.match(phasesToMermaid([]), /No phases/);
});

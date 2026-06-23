import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan } from '../src/parser.js';
import { deriveStats, deriveCommands, deriveDeps } from '../src/derive.js';

test('deriveStats counts model parts', () => {
  const m = parsePlan('## Tasks\n- [x] a\n- [ ] b\n\n```js\nx\n```');
  const s = deriveStats(m);
  assert.equal(s.tasks, 1);
  assert.equal(s.steps, 2);
  assert.equal(s.done, 1);
  assert.equal(s.code, 1);
});

test('deriveCommands collects shell lines and Run: lines, deduped', () => {
  const m = parsePlan('## Build\n\nRun: `npm install`\n\n```bash\nnpm install\ngit status\n# a comment\n```');
  const { commands } = deriveCommands(m);
  assert.deepEqual(commands, ['npm install', 'git status']);
});

test('deriveCommands extracts commit messages', () => {
  const m = parsePlan('```bash\ngit commit -m "feat: thing"\ngit commit -m "fix: bug"\n```');
  const { commits } = deriveCommands(m);
  assert.deepEqual(commits, ['feat: thing', 'fix: bug']);
});

test('deriveDeps links phases by "after" reference', () => {
  const m = parsePlan('### Task 1\n1. do x\n\n### Task 2\n1. run after Task 1');
  const deps = deriveDeps(m);
  assert.deepEqual(deps['Task 2'], ['Task 1']);
});

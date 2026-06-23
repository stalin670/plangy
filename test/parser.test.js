import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan } from '../src/parser.js';

test('extracts phases from headings with numbered steps', () => {
  const md = `# Setup
1. Install deps
2. Configure
# Build
1. Compile`;
  const m = parsePlan(md);
  assert.equal(m.phases.length, 2);
  assert.equal(m.phases[0].title, 'Setup');
  assert.deepEqual(m.phases[0].steps.map(s => s.text), ['Install deps', 'Configure']);
  assert.equal(m.phases[1].title, 'Build');
});

test('loose prose with no heading becomes notes', () => {
  const m = parsePlan('Just some thoughts here.');
  assert.deepEqual(m.notes, ['Just some thoughts here.']);
  assert.equal(m.phases.length, 0);
});

test('empty input yields empty model', () => {
  const m = parsePlan('');
  assert.deepEqual(m, { phases: [], tasks: [], files: [], mermaid: [], tables: [], notes: [] });
});

test('groups checklist items under heading with done/total counts', () => {
  const md = `## Tasks
- [ ] first
- [x] second`;
  const m = parsePlan(md);
  assert.equal(m.tasks.length, 1);
  assert.equal(m.tasks[0].heading, 'Tasks');
  assert.equal(m.tasks[0].total, 2);
  assert.equal(m.tasks[0].done, 1);
  assert.deepEqual(m.tasks[0].items, [
    { text: 'first', checked: false },
    { text: 'second', checked: true },
  ]);
});

test('captures mermaid code blocks as raw source', () => {
  const md = '```mermaid\ngraph TD;A-->B;\n```';
  const m = parsePlan(md);
  assert.deepEqual(m.mermaid, ['graph TD;A-->B;']);
});

test('captures gfm tables as header and rows', () => {
  const md = `| a | b |
|---|---|
| 1 | 2 |`;
  const m = parsePlan(md);
  assert.equal(m.tables.length, 1);
  assert.deepEqual(m.tables[0].header, ['a', 'b']);
  assert.deepEqual(m.tables[0].rows, [['1', '2']]);
});

test('collects file paths from inline code with referencing phase', () => {
  const md = `## Build
Edit \`src/server.js\` and \`web/app.css\`.
Mention of \`README\` (no ext) is ignored.`;
  const m = parsePlan(md);
  assert.deepEqual(m.files.map(f => f.path), ['src/server.js', 'web/app.css']);
  assert.equal(m.files[0].phaseTitle, 'Build');
});

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
  assert.deepEqual(m, {
    phases: [], tasks: [], files: [], mermaid: [], tables: [], notes: [],
    code: [], outline: [], meta: {}, frontmatter: {}, runs: [],
  });
});

test('extracts bold key-value lines as metadata', () => {
  const m = parsePlan('# Plan\n\n**Goal:** ship it fast\n\n**Status:** draft');
  assert.equal(m.meta.Goal, 'ship it fast');
  assert.equal(m.meta.Status, 'draft');
});

test('parses yaml frontmatter', () => {
  const m = parsePlan('---\ntitle: My Plan\nstatus: active\n---\n# Body');
  assert.equal(m.frontmatter.title, 'My Plan');
  assert.equal(m.frontmatter.status, 'active');
  assert.equal(m.phases[0].title, 'Body');
});

test('captures non-mermaid code blocks with language and phase', () => {
  const m = parsePlan('## Build\n\n```bash\nnpm test\n```');
  assert.equal(m.code.length, 1);
  assert.equal(m.code[0].lang, 'bash');
  assert.equal(m.code[0].phaseTitle, 'Build');
  assert.match(m.code[0].value, /npm test/);
});

test('builds an outline of headings', () => {
  const m = parsePlan('# A\n## B\n### C');
  assert.deepEqual(m.outline.map(h => `${h.depth}:${h.title}`), ['1:A', '2:B', '3:C']);
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
    { text: 'first', checked: false, line: 2 },
    { text: 'second', checked: true, line: 3 },
  ]);
});

test('merges checklist fragments under one heading into a single group', () => {
  // Code between items splits the markdown list into separate list nodes;
  // they must still collapse into one task group for the heading.
  const md = `### Task 1
- [ ] step one

\`\`\`
some code
\`\`\`

- [x] step two`;
  const m = parsePlan(md);
  assert.equal(m.tasks.length, 1);
  assert.equal(m.tasks[0].heading, 'Task 1');
  assert.equal(m.tasks[0].total, 2);
  assert.equal(m.tasks[0].done, 1);
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

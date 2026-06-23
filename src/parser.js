import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const processor = unified().use(remarkParse).use(remarkGfm);

function textOf(node) {
  if (node.value) return node.value;
  if (!node.children) return '';
  return node.children.map(textOf).join('');
}

const PATH_RE = /^[\w.\-/]+\.[a-zA-Z0-9]+$/;
function looksLikePath(v) {
  return PATH_RE.test(v) && (v.includes('/') || /\.(js|ts|tsx|jsx|py|css|html|json|md|go|rs|java)$/.test(v));
}
function collectInlineCode(node, out) {
  if (node.type === 'inlineCode') out.push(node.value);
  if (node.children) for (const c of node.children) collectInlineCode(c, out);
}

let counter = 0;
const nextId = (prefix) => `${prefix}-${counter++}`;

export function parsePlan(md) {
  counter = 0;
  const model = { phases: [], tasks: [], files: [], mermaid: [], tables: [], notes: [] };
  if (!md || !md.trim()) return model;

  const tree = processor.parse(md);
  let current = null;
  // Checklist items are grouped by their enclosing heading. Markdown splits a
  // list into several list nodes when other blocks (code, paragraphs) sit
  // between items, so we merge every checklist under the same heading into one
  // group instead of emitting a group per fragment.
  const taskGroups = new Map();
  const seenFiles = new Set();

  for (const node of tree.children) {
    if (node.type === 'heading') {
      current = { id: nextId('phase'), title: textOf(node).trim(), depth: node.depth, steps: [] };
      model.phases.push(current);
    } else if (node.type === 'code' && node.lang === 'mermaid') {
      model.mermaid.push((node.value || '').trim());
    } else if (node.type === 'table') {
      const rows = node.children.map(row => row.children.map(cell => textOf(cell).trim()));
      model.tables.push({ header: rows[0] || [], rows: rows.slice(1) });
    } else if (node.type === 'list' && node.ordered && current) {
      for (const item of node.children) {
        current.steps.push({ id: nextId('step'), text: textOf(item).trim() });
      }
    } else if (node.type === 'list' && !node.ordered) {
      const items = [];
      for (const item of node.children) {
        if (typeof item.checked === 'boolean') {
          items.push({ text: textOf(item).trim(), checked: item.checked });
        }
      }
      if (items.length) {
        const key = current ? current.id : '__root__';
        let group = taskGroups.get(key);
        if (!group) {
          group = { id: nextId('tasks'), heading: current ? current.title : 'Tasks', items: [], done: 0, total: 0 };
          taskGroups.set(key, group);
          model.tasks.push(group);
        }
        group.items.push(...items);
        group.total = group.items.length;
        group.done = group.items.filter(i => i.checked).length;
      }
    } else if (node.type === 'paragraph' && !current) {
      model.notes.push(textOf(node).trim());
    }

    if (node.type !== 'heading' && node.type !== 'code') {
      const codes = [];
      collectInlineCode(node, codes);
      for (const v of codes) {
        if (looksLikePath(v) && !seenFiles.has(v)) {
          seenFiles.add(v);
          model.files.push({ path: v, phaseTitle: current ? current.title : '' });
        }
      }
    }
  }
  return model;
}

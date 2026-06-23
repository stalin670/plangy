const app = document.getElementById('app');
const statusEl = document.getElementById('status');

mermaid.initialize({ startOnLoad: false });

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else n.setAttribute(k, v);
  }
  for (const k of kids) n.append(k);
  return n;
}

function section(id, title) {
  const s = el('section', { id });
  const h = el('h2', {}, title);
  h.addEventListener('click', () => s.classList.toggle('collapsed'));
  s.append(h);
  return s;
}

let _c = 0; const id = () => _c++;

async function renderMermaid(container, src, i) {
  try {
    const { svg } = await mermaid.render(`m${id()}_${i}`, src);
    const d = el('div'); d.innerHTML = svg; container.append(d);
  } catch (e) {
    container.append(el('pre', { class: 'err' }, `mermaid error: ${e.message}`));
  }
}

async function render(model) {
  app.innerHTML = '';

  const flow = section('flow', 'Flow');
  await renderMermaid(flow, model.flow, 'flow');
  app.append(flow);

  if (model.tasks.length) {
    const t = section('tasks', 'Tasks');
    for (const g of model.tasks) {
      const pct = g.total ? Math.round((g.done / g.total) * 100) : 0;
      t.append(el('h3', {}, `${g.heading} — ${g.done}/${g.total} (${pct}%)`));
      const bar = el('div', { class: 'bar' }); bar.append(el('i', { style: `width:${pct}%` }));
      t.append(bar);
      for (const it of g.items) {
        t.append(el('div', { class: 'task' + (it.checked ? ' done' : '') }, (it.checked ? '☑ ' : '☐ ') + it.text));
      }
    }
    app.append(t);
  }

  if (model.files.length) {
    const f = section('files', 'Files');
    const ul = el('ul', { class: 'tree' });
    for (const fr of model.files) {
      ul.append(el('li', {}, fr.path + (fr.phaseTitle ? `  (${fr.phaseTitle})` : '')));
    }
    f.append(ul); app.append(f);
  }

  if (model.mermaid.length) {
    const d = section('diagrams', 'Diagrams');
    for (let i = 0; i < model.mermaid.length; i++) await renderMermaid(d, model.mermaid[i], i);
    app.append(d);
  }

  if (model.tables.length) {
    const tb = section('tables', 'Tables');
    for (const t of model.tables) {
      const table = el('table');
      const thead = el('tr'); for (const h of t.header) thead.append(el('th', {}, h));
      table.append(thead);
      for (const row of t.rows) { const tr = el('tr'); for (const c of row) tr.append(el('td', {}, c)); table.append(tr); }
      tb.append(table);
    }
    app.append(tb);
  }

  if (model.notes.length) {
    const n = section('notes', 'Notes');
    for (const note of model.notes) n.append(el('p', {}, note));
    app.append(n);
  }
}

async function load() {
  const model = await fetch('/model').then(r => r.json());
  await render(model);
  statusEl.classList.remove('stale');
}

const es = new EventSource('/events');
es.addEventListener('update', () => { statusEl.classList.add('stale'); load(); });
es.onerror = () => statusEl.classList.add('stale');

load();

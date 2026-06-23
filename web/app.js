const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const navEl = document.getElementById('nav');

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  themeVariables: {
    background: '#161A21',
    primaryColor: '#1B212B',
    primaryBorderColor: '#5AA2FF',
    primaryTextColor: '#E6EDF3',
    secondaryColor: '#1B212B',
    tertiaryColor: '#161A21',
    lineColor: '#3A4756',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: '13px',
  },
  flowchart: { htmlLabels: true, curve: 'basis', nodeSpacing: 26, rankSpacing: 40, padding: 8 },
});

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}

let _c = 0;
const uid = () => _c++;

function section(id, eyebrow, title, count) {
  const s = el('section', { id });
  const eb = el('div', { class: 'eyebrow' }, eyebrow);
  if (count) eb.append(el('span', { class: 'count' }, count));
  const h = el('h2', {}, title);
  h.addEventListener('click', () => s.classList.toggle('collapsed'));
  s.append(eb, h);
  return s;
}

async function renderMermaid(container, src, i) {
  const wrap = el('div', { class: 'mermaid-wrap' });
  try {
    const { svg } = await mermaid.render(`m${uid()}_${i}`, src);
    wrap.innerHTML = svg;
  } catch (e) {
    wrap.append(el('div', { class: 'err' }, `diagram error: ${e.message}`));
  }
  container.append(wrap);
}

function filePath(p) {
  const i = p.lastIndexOf('/');
  if (i < 0) return el('span', { class: 'path' }, p);
  return el('span', { class: 'path' }, el('span', { class: 'dir' }, p.slice(0, i + 1)), p.slice(i + 1));
}

async function render(model) {
  app.innerHTML = '';
  const nav = [];

  // ---- Flow (custom pipeline) ----
  const pipeline = model.pipeline && model.pipeline.length
    ? model.pipeline
    : (model.phases || []).map((p, i) => ({ n: i + 1, title: p.title, steps: 0, done: 0 }));
  const flow = section('flow', 'pipeline', 'Flow', `${pipeline.length} phases`);
  if (pipeline.length) {
    const rail = el('div', { class: 'pipeline' });
    for (const ph of pipeline) {
      const done = ph.steps > 0 && ph.done === ph.steps;
      const node = el('div', { class: 'pnode' + (done ? ' done' : '') });
      node.append(el('span', { class: 'pnum' }, done ? '✓' : String(ph.n).padStart(2, '0')));
      const card = el('div', { class: 'pcard' }, el('span', { class: 'ptitle' }, ph.title));
      if (ph.steps) card.append(el('span', { class: 'psteps' }, `${ph.done}/${ph.steps}`));
      node.append(card);
      rail.append(node);
    }
    flow.append(rail);
  } else {
    await renderMermaid(flow, model.flow, 'flow');
  }
  app.append(flow);
  nav.push(['flow', 'Flow']);

  // ---- Tasks ----
  if (model.tasks.length) {
    const totDone = model.tasks.reduce((a, g) => a + g.done, 0);
    const totAll = model.tasks.reduce((a, g) => a + g.total, 0);
    const t = section('tasks', 'progress', 'Tasks', `${totDone}/${totAll} done`);
    for (const g of model.tasks) {
      const pct = g.total ? Math.round((g.done / g.total) * 100) : 0;
      const state = pct === 100 ? 'done' : pct > 0 ? 'part' : 'zero';
      const pillText = state === 'done' ? 'done' : state === 'part' ? 'in progress' : 'todo';
      const group = el('div', { class: `taskgroup ${state}` });
      group.append(el('div', { class: 'tg-head' },
        el('span', { class: 'tg-title' }, g.heading),
        el('span', { class: `pill ${state}` }, pillText),
        el('span', { class: 'tg-meta' }, el('b', {}, `${g.done}/${g.total}`), ` · ${pct}%`),
      ));
      const rail = el('div', { class: `rail ${state}` });
      rail.append(el('span', { style: `width:${state === 'zero' ? 0 : pct}%` }));
      group.append(rail);
      const items = el('div', { class: 'items' });
      for (const it of g.items) {
        items.append(el('div', { class: 'item' + (it.checked ? ' on' : '') },
          el('span', { class: 'chk' }, it.checked ? '✓' : ''),
          el('span', { class: 'txt' }, it.text),
        ));
      }
      group.append(items);
      t.append(group);
    }
    app.append(t);
    nav.push(['tasks', 'Tasks']);
  }

  // ---- Files ----
  if (model.files.length) {
    const f = section('files', 'change map', 'Files', `${model.files.length} files`);
    const list = el('div', { class: 'files' });
    for (const fr of model.files) {
      const row = el('div', { class: 'file' }, filePath(fr.path));
      if (fr.phaseTitle) row.append(el('span', { class: 'chip' }, fr.phaseTitle));
      list.append(row);
    }
    f.append(list);
    app.append(f);
    nav.push(['files', 'Files']);
  }

  // ---- Diagrams ----
  if (model.mermaid.length) {
    const d = section('diagrams', 'embedded', 'Diagrams', `${model.mermaid.length}`);
    for (let i = 0; i < model.mermaid.length; i++) await renderMermaid(d, model.mermaid[i], i);
    app.append(d);
    nav.push(['diagrams', 'Diagrams']);
  }

  // ---- Tables ----
  if (model.tables.length) {
    const tb = section('tables', 'data', 'Tables', `${model.tables.length}`);
    for (const tbl of model.tables) {
      const wrap = el('div', { class: 'tbl-wrap' });
      const table = el('table');
      const thead = el('tr');
      for (const h of tbl.header) thead.append(el('th', {}, h));
      table.append(thead);
      for (const row of tbl.rows) {
        const tr = el('tr');
        for (const c of row) tr.append(el('td', {}, c));
        table.append(tr);
      }
      wrap.append(table);
      tb.append(wrap);
    }
    app.append(tb);
    nav.push(['tables', 'Tables']);
  }

  // ---- Notes ----
  if (model.notes.length) {
    const n = section('notes', 'context', 'Notes', `${model.notes.length}`);
    const box = el('div', { class: 'notes' });
    for (const note of model.notes) box.append(el('p', {}, note));
    n.append(box);
    app.append(n);
    nav.push(['notes', 'Notes']);
  }

  // ---- Nav ----
  navEl.innerHTML = '';
  for (const [id, label] of nav) navEl.append(el('a', { href: `#${id}` }, label));
}

async function load() {
  try {
    const model = await fetch('/model').then(r => r.json());
    await render(model);
    statusEl.classList.remove('stale');
  } catch (e) {
    statusEl.classList.add('stale');
  }
}

const es = new EventSource('/events');
es.addEventListener('update', () => { statusEl.classList.add('stale'); load(); });
es.onerror = () => statusEl.classList.add('stale');

load();

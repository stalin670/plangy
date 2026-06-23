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

function copyBtn(getText) {
  const b = el('button', { class: 'copy', title: 'Copy' }, 'copy');
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(getText()); b.textContent = 'copied'; setTimeout(() => (b.textContent = 'copy'), 1200); }
    catch { b.textContent = 'failed'; }
  });
  return b;
}

async function render(model) {
  app.innerHTML = '';
  const nav = [];
  const stats = model.stats || {};
  const meta = { ...(model.frontmatter || {}), ...(model.meta || {}) };

  // ---- Overview (title, stats, metadata) ----
  const h1 = (model.phases || []).find(p => p.depth === 1);
  const title = meta.title || (h1 && h1.title) || 'Plan';
  const hero = el('section', { class: 'hero', id: 'overview' });
  hero.append(el('div', { class: 'eyebrow' }, 'plan'));
  hero.append(el('h1', { class: 'hero-title' }, title));
  const statRow = el('div', { class: 'stats' });
  const stat = (n, l) => el('div', { class: 'stat' }, el('span', { class: 'sv' }, String(n)), el('span', { class: 'sl' }, l));
  if (stats.tasks) statRow.append(stat(stats.tasks, 'tasks'));
  if (stats.steps) statRow.append(stat(`${stats.done}/${stats.steps}`, 'steps'));
  if (stats.files) statRow.append(stat(stats.files, 'files'));
  if (stats.code) statRow.append(stat(stats.code, 'code'));
  if (stats.diagrams) statRow.append(stat(stats.diagrams, 'diagrams'));
  if (statRow.childNodes.length) hero.append(statRow);
  const mkeys = Object.keys(meta).filter(k => k.toLowerCase() !== 'title');
  if (mkeys.length) {
    const grid = el('div', { class: 'meta' });
    for (const k of mkeys) grid.append(el('div', { class: 'mrow' }, el('span', { class: 'mk' }, k), el('span', { class: 'mv' }, meta[k])));
    hero.append(grid);
  }
  app.append(hero);
  nav.push(['overview', 'Overview']);

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
      if (ph.deps && ph.deps.length) card.append(el('span', { class: 'pdep' }, `after ${ph.deps.join(', ')}`));
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

  // ---- Commands ----
  if ((model.commands && model.commands.length) || (model.commits && model.commits.length)) {
    const c = section('commands', 'runnable', 'Commands', `${(model.commands || []).length}`);
    if (model.commands && model.commands.length) {
      const block = el('div', { class: 'cmdblock' });
      block.append(copyBtn(() => model.commands.join('\n')));
      const pre = el('pre', { class: 'cmd' });
      for (const cmd of model.commands) pre.append(el('span', { class: 'cmdline' }, el('span', { class: 'prompt' }, '$ '), cmd));
      block.append(pre);
      c.append(block);
    }
    if (model.commits && model.commits.length) {
      c.append(el('div', { class: 'subhead' }, 'commit sequence'));
      const ol = el('ol', { class: 'commits' });
      for (const msg of model.commits) ol.append(el('li', {}, msg));
      c.append(ol);
    }
    app.append(c);
    nav.push(['commands', 'Commands']);
  }

  // ---- Code ----
  if (model.code && model.code.length) {
    const cd = section('code', 'snippets', 'Code', `${model.code.length}`);
    cd.classList.add('collapsed'); // heavy; start collapsed
    let lastPhase = null;
    for (const blk of model.code) {
      if (blk.phaseTitle && blk.phaseTitle !== lastPhase) {
        cd.append(el('div', { class: 'subhead' }, blk.phaseTitle));
        lastPhase = blk.phaseTitle;
      }
      const wrap = el('div', { class: 'codeblock' });
      const bar = el('div', { class: 'codebar' }, el('span', { class: 'lang' }, blk.lang || 'text'));
      bar.append(copyBtn(() => blk.value));
      wrap.append(bar, el('pre', { class: 'code' }, el('code', {}, blk.value)));
      cd.append(wrap);
    }
    app.append(cd);
    nav.push(['code', 'Code']);
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

  // ---- Outline ----
  if (model.outline && model.outline.length > 1) {
    const o = section('outline', 'structure', 'Outline', `${model.outline.length}`);
    const minDepth = Math.min(...model.outline.map(h => h.depth));
    const list = el('div', { class: 'outline' });
    for (const h of model.outline) {
      list.append(el('div', { class: 'oitem', style: `padding-left:${(h.depth - minDepth) * 1.1}rem` },
        el('span', { class: 'odepth' }, 'H' + h.depth),
        el('span', {}, h.title),
      ));
    }
    o.append(list);
    app.append(o);
    nav.push(['outline', 'Outline']);
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

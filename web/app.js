const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const navEl = document.getElementById('nav');

// Static demo boot: when an inlined model is present, run read-only with no server.
const BOOT = (typeof window !== 'undefined' && window.__PLANGY_BOOT__) || null;

// ---- preferences (theme + collapsed panels), persisted ----
const PREF_KEY = 'plangy-prefs';
let prefs = { theme: 'dark', collapsed: {} };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { /* ignore */ }
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }
function applyTheme() { document.documentElement.dataset.theme = prefs.theme; }
applyTheme();

function persistCollapse() {
  const c = {};
  app.querySelectorAll('section[id]').forEach(s => { if (s.id !== 'overview') c[s.id] = s.classList.contains('collapsed'); });
  prefs.collapsed = c;
  savePrefs();
}
function applyCollapsePrefs() {
  app.querySelectorAll('section[id]').forEach(s => {
    if (s.id === 'overview') return;
    const want = (s.id in prefs.collapsed) ? prefs.collapsed[s.id] : (s.id === 'code');
    s.classList.toggle('collapsed', want);
  });
}

const themeBtn = document.getElementById('theme');
function syncThemeBtn() { themeBtn.textContent = prefs.theme === 'light' ? 'dark' : 'light'; }
themeBtn.addEventListener('click', () => {
  prefs.theme = prefs.theme === 'light' ? 'dark' : 'light';
  applyTheme(); savePrefs(); syncThemeBtn();
});
syncThemeBtn();

// ---- edit mode + export ----
let currentModel = null;
let currentFile = 0; // index when multiple plan files are served
let editing = false;
const pending = new Map();        // source line -> checked boolean
const pendingText = new Map();    // source line -> new task text
const reorderedGroups = new Map(); // group id -> [item source lines, in new order]

// A group can be reordered only when its items occupy consecutive source lines
// (no interleaved code/prose between them) — that keeps the line-level export safe.
function contiguous(g) {
  const ls = g.items.map(i => i.line);
  if (ls.some(x => x == null)) return false;
  const sorted = ls.slice().sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
  return true;
}

function findItem(line) {
  if (!currentModel) return null;
  for (const g of currentModel.tasks) for (const it of g.items) if (it.line === line) return it;
  return null;
}

// ---- version diff (vs a saved baseline) ----
let diffMode = false;
let currentDiff = null; // computed each render when diffMode + baseline exist
function baselineKey() { return 'plangy-base-' + ((currentModel && currentModel.fileName) || 'plan'); }
function taskSig(model) { return model.tasks.map(g => ({ h: g.heading, items: g.items.map(i => ({ t: i.text, c: i.checked })) })); }
function getBaseline() { try { return JSON.parse(localStorage.getItem(baselineKey()) || 'null'); } catch { return null; } }
function setBaseline() { if (currentModel) localStorage.setItem(baselineKey(), JSON.stringify({ at: Date.now(), tasks: taskSig(currentModel) })); }
function clearBaseline() { localStorage.removeItem(baselineKey()); }

function computeDiff() {
  const base = getBaseline();
  if (!base || !currentModel) return null;
  const baseGroups = new Map(base.tasks.map(g => [g.h, g.items]));
  const info = { at: base.at, perGroup: new Map(), added: 0, removed: 0, doneUp: 0 };
  for (const g of currentModel.tasks) {
    const bItems = baseGroups.get(g.heading) || [];
    const bByText = new Map(bItems.map(i => [i.t, i]));
    const curTexts = new Set(g.items.map(i => i.text));
    const added = new Set(), doneChanged = new Map();
    for (const it of g.items) {
      const b = bByText.get(it.text);
      if (!b) { added.add(it.text); info.added++; }
      else if (b.c !== it.checked) { doneChanged.set(it.text, it.checked); if (it.checked) info.doneUp++; }
    }
    const removed = bItems.filter(i => !curTexts.has(i.t));
    info.removed += removed.length;
    info.perGroup.set(g.heading, { added, doneChanged, removed });
    baseGroups.delete(g.heading);
  }
  for (const [h, items] of baseGroups) { info.removed += items.length; info.perGroup.set(h, { added: new Set(), doneChanged: new Map(), removed: items, gone: true }); }
  return info;
}

const diffBtn = document.getElementById('diff');
function syncDiffBtn() { diffBtn.classList.toggle('on', diffMode); }
diffBtn.addEventListener('click', () => { diffMode = !diffMode; syncDiffBtn(); rerender(); });
syncDiffBtn();

const filesSel = document.getElementById('files');
async function initFiles() {
  let list = [];
  if (BOOT) list = BOOT.files || [{ i: 0, name: BOOT.model.fileName }];
  else { try { list = await fetch('/files').then(r => r.json()); } catch { /* single-file fallback */ } }
  if (list.length > 1) {
    filesSel.innerHTML = '';
    for (const f of list) filesSel.append(el('option', { value: String(f.i) }, f.name));
    filesSel.hidden = false;
    filesSel.addEventListener('change', () => {
      currentFile = Number(filesSel.value);
      pending.clear(); pendingText.clear(); reorderedGroups.clear(); // edits are per-file
      load();
    });
  } else {
    filesSel.hidden = true;
  }
}

function applyPending() {
  if (!currentModel) return;
  for (const g of currentModel.tasks) {
    for (const it of g.items) {
      if (it.line != null && pending.has(it.line)) it.checked = pending.get(it.line);
    }
    g.done = g.items.filter(i => i.checked).length;
    g.total = g.items.length;
  }
  if (currentModel.stats) currentModel.stats.done = currentModel.tasks.reduce((a, g) => a + g.done, 0);
}

function rerender() {
  const y = window.scrollY;
  render(currentModel).then(() => window.scrollTo(0, y));
}

// Produce the edited content for a single source line (text edit then checkbox).
function editedLine(origLine, orig) {
  let s = orig[origLine - 1];
  if (s == null) return s;
  if (pendingText.has(origLine)) s = s.replace(/^(\s*[-*+]\s*\[[ xX]\]\s*).*$/, (m, p1) => p1 + pendingText.get(origLine));
  if (pending.has(origLine)) s = s.replace(/\[( |x|X)\]/, pending.get(origLine) ? '[x]' : '[ ]');
  return s;
}

function patchRaw(raw) {
  const orig = raw.split(/\r?\n/);
  const out = orig.slice();
  const handled = new Set();
  // reordered groups: write each item's edited content into the group's sorted
  // line positions, in the new item order
  for (const order of reorderedGroups.values()) for (const ln of order) handled.add(ln);
  for (const order of reorderedGroups.values()) {
    const positions = order.slice().sort((a, b) => a - b);
    order.forEach((ln, k) => { if (positions[k] != null) out[positions[k] - 1] = editedLine(ln, orig); });
  }
  // remaining checkbox/text edits not inside a reordered group: apply in place
  for (const ln of new Set([...pending.keys(), ...pendingText.keys()])) {
    if (!handled.has(ln) && ln >= 1 && ln <= orig.length) out[ln - 1] = editedLine(ln, orig);
  }
  return out.join('\n');
}

function moveItem(g, idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= g.items.length) return;
  const arr = g.items;
  [arr[idx], arr[j]] = [arr[j], arr[idx]];
  reorderedGroups.set(g.id, arr.map(i => i.line));
  rerender();
  updateEditbar();
}
async function exportMarkdown() {
  const raw = BOOT ? (BOOT.raw || '') : await fetch(`/raw?i=${currentFile}`).then(r => r.text());
  return patchRaw(raw);
}

document.getElementById('print').addEventListener('click', () => {
  // expand everything so nothing is clipped in the printout, then print
  app.querySelectorAll('section.collapsed').forEach(s => s.classList.remove('collapsed'));
  setTimeout(() => window.print(), 60);
});

const editBtn = document.getElementById('edit');
function syncEditBtn() { editBtn.textContent = editing ? 'editing' : 'edit'; editBtn.classList.toggle('on', editing); }
editBtn.addEventListener('click', () => {
  editing = !editing;
  document.body.classList.toggle('editing', editing);
  syncEditBtn();
  rerender(); // toggle contenteditable / checkbox affordances
  updateEditbar();
});

// clicking a task checkbox while editing toggles it (tracked by source line)
app.addEventListener('click', e => {
  if (!editing) return;
  const chk = e.target.closest('.chk');
  if (!chk) return;
  const item = chk.closest('.item[data-line]');
  if (!item) return;
  const line = Number(item.getAttribute('data-line'));
  if (!line) return;
  pending.set(line, !item.classList.contains('on'));
  applyPending();
  rerender();
  updateEditbar();
});

// editing a task's text (contenteditable) is tracked on blur
app.addEventListener('focusout', e => {
  if (!editing) return;
  const txt = e.target.closest('.txt[contenteditable="true"]');
  if (!txt) return;
  const line = Number(txt.dataset.line);
  const next = txt.textContent.replace(/\s+/g, ' ').trim();
  if (!line || next === txt.dataset.orig) return;
  pendingText.set(line, next);
  const it = findItem(line);
  if (it) it.text = next;
  txt.dataset.orig = next;
  updateEditbar();
});

// floating export bar (visible only in edit mode)
const editbar = el('div', { class: 'editbar', id: 'editbar' });
const editcount = el('span', { class: 'editcount' }, '0 edits');
const btnCopy = el('button', { class: 'ebtn primary' }, 'Copy .md');
const btnDownload = el('button', { class: 'ebtn' }, 'Download .md');
const btnReset = el('button', { class: 'ebtn ghost' }, 'Reset');
btnCopy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(await exportMarkdown()); btnCopy.textContent = 'Copied!'; setTimeout(() => (btnCopy.textContent = 'Copy .md'), 1200); }
  catch { btnCopy.textContent = 'Failed'; }
});
btnDownload.addEventListener('click', async () => {
  const md = await exportMarkdown();
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = el('a', { href: URL.createObjectURL(blob), download: (currentModel && currentModel.fileName) || 'plan.md' });
  a.click();
  URL.revokeObjectURL(a.href);
});
btnReset.addEventListener('click', () => { pending.clear(); pendingText.clear(); reorderedGroups.clear(); load(); updateEditbar(); });
editbar.append(editcount, btnReset, btnDownload, btnCopy);
document.body.append(editbar);
function updateEditbar() {
  const n = pending.size + pendingText.size + reorderedGroups.size;
  editcount.textContent = `${n} edit${n === 1 ? '' : 's'}`;
  editbar.classList.toggle('show', editing);
}
syncEditBtn();

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
  h.addEventListener('click', () => { s.classList.toggle('collapsed'); persistCollapse(); });
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

// ---- tiny offline syntax highlighter (js / json / bash) ----
function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}
const GRAMMARS = {
  js: [
    ['comment', String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
    ['string', String.raw`\`(?:\\.|[^\`\\])*\`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"`],
    ['number', String.raw`\b0[xX][0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b`],
    ['keyword', String.raw`\b(?:const|let|var|function|return|if|else|for|of|in|while|switch|case|break|continue|import|from|export|default|async|await|new|class|extends|super|this|try|catch|finally|throw|typeof|instanceof|yield|void|delete|null|true|false|undefined)\b`],
    ['fn', String.raw`[A-Za-z_$][\w$]*(?=\s*\()`],
  ],
  json: [
    ['string', String.raw`"(?:\\.|[^"\\])*"`],
    ['number', String.raw`-?\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b`],
    ['keyword', String.raw`\b(?:true|false|null)\b`],
  ],
  bash: [
    ['comment', String.raw`#[^\n]*`],
    ['string', String.raw`"(?:\\.|[^"\\])*"|'[^']*'`],
    ['builtin', String.raw`\b(?:npm|npx|pnpm|yarn|node|git|docker|python|pip|go|cargo|make|curl|wget|mkdir|rm|cp|mv|cd|echo|export|cat|sleep|kill|taskkill)\b`],
    ['keyword', String.raw`\b(?:if|then|else|elif|fi|for|do|done|in|while|case|esac|function|return)\b`],
    ['flag', String.raw`(?<=\s)-{1,2}[A-Za-z][\w-]*`],
  ],
};
const LANG_ALIAS = { js: 'js', javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', json: 'json', bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash' };

function highlightCode(code, lang) {
  const g = GRAMMARS[LANG_ALIAS[(lang || '').toLowerCase()]];
  if (!g) return escapeHtml(code);
  const re = new RegExp(g.map(([c, src]) => `(?<${c}>${src})`).join('|'), 'gm');
  let out = '', last = 0, m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out += escapeHtml(code.slice(last, m.index));
    const cls = Object.keys(m.groups).find(k => m.groups[k] !== undefined);
    out += `<span class="t-${cls}">${escapeHtml(m[0])}</span>`;
    last = re.lastIndex;
    if (m[0] === '') re.lastIndex++;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

function progressRing(pct) {
  const r = 34;
  const circ = (2 * Math.PI * r).toFixed(1);
  const offset = (2 * Math.PI * r * (1 - pct / 100)).toFixed(1);
  return `<svg viewBox="0 0 80 80" class="ring" role="img" aria-label="${pct}% complete">
    <circle class="ring-track" cx="40" cy="40" r="${r}"></circle>
    <circle class="ring-bar${pct === 100 ? ' full' : ''}" cx="40" cy="40" r="${r}"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle>
    <text x="40" y="38" class="ring-pct">${pct}%</text>
    <text x="40" y="52" class="ring-sub">done</text>
  </svg>`;
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

  // ---- Overview (title, stats, metadata, progress ring) ----
  const h1 = (model.phases || []).find(p => p.depth === 1);
  const title = meta.title || (h1 && h1.title) || 'Plan';
  const hero = el('section', { class: 'hero', id: 'overview' });
  const main = el('div', { class: 'hero-main' });
  main.append(el('div', { class: 'eyebrow' }, 'plan'));
  main.append(el('h1', { class: 'hero-title' }, title));
  const statRow = el('div', { class: 'stats' });
  const stat = (n, l) => el('div', { class: 'stat' }, el('span', { class: 'sv' }, String(n)), el('span', { class: 'sl' }, l));
  if (stats.tasks) statRow.append(stat(stats.tasks, 'tasks'));
  if (stats.steps) statRow.append(stat(`${stats.done}/${stats.steps}`, 'steps'));
  if (stats.files) statRow.append(stat(stats.files, 'files'));
  if (stats.code) statRow.append(stat(stats.code, 'code'));
  if (stats.diagrams) statRow.append(stat(stats.diagrams, 'diagrams'));
  if (statRow.childNodes.length) main.append(statRow);
  const mkeys = Object.keys(meta).filter(k => k.toLowerCase() !== 'title');
  if (mkeys.length) {
    const grid = el('div', { class: 'meta' });
    for (const k of mkeys) grid.append(el('div', { class: 'mrow' }, el('span', { class: 'mk' }, k), el('span', { class: 'mv' }, meta[k])));
    main.append(grid);
  }
  const top = el('div', { class: 'hero-top' }, main);
  if (stats.steps) {
    const pct = Math.round((stats.done / stats.steps) * 100);
    top.append(el('div', { class: 'hero-ring', html: progressRing(pct) }));
  }
  hero.append(top);
  app.append(hero);
  nav.push(['overview', 'Overview']);

  // ---- Changes (diff vs baseline) ----
  currentDiff = diffMode ? computeDiff() : null;
  if (diffMode) {
    const actionBtn = (label, fn, variant) => { const b = el('button', { class: 'ebtn' + (variant ? ' ' + variant : '') }, label); b.addEventListener('click', fn); return b; };
    const cs = el('section', { id: 'changes' });
    cs.append(el('div', { class: 'eyebrow' }, 'diff'));
    if (!currentDiff) {
      cs.append(el('div', { class: 'changerow' },
        el('span', { class: 'changewhen' }, 'No baseline saved for this plan yet. Set one, then changes show up here.'),
        actionBtn('Set baseline', () => { setBaseline(); rerender(); }, 'primary'),
      ));
    } else {
      const d = currentDiff;
      const chip = (t, c) => el('span', { class: 'dchip ' + c }, t);
      cs.append(el('div', { class: 'changerow' },
        el('span', { class: 'changesum' }, chip(`+${d.doneUp} done`, 'done'), chip(`${d.added} added`, 'add'), chip(`${d.removed} removed`, 'rem')),
        el('span', { class: 'changewhen' }, `since ${new Date(d.at).toLocaleString()}`),
        actionBtn('Re-baseline', () => { setBaseline(); rerender(); }),
        actionBtn('Clear', () => { clearBaseline(); rerender(); }, 'ghost'),
      ));
    }
    app.append(cs);
    nav.push(['changes', 'Changes']);
  }

  // ---- Flow (custom pipeline) ----
  const pipeline = model.pipeline && model.pipeline.length
    ? model.pipeline
    : (model.phases || []).map((p, i) => ({ n: i + 1, title: p.title, steps: 0, done: 0 }));
  const flow = section('flow', 'pipeline', 'Flow', `${pipeline.length} phases`);
  if (pipeline.length) {
    const rail = el('div', { class: 'pipeline' });
    for (const ph of pipeline) {
      const done = ph.steps > 0 && ph.done === ph.steps;
      const node = el('div', { class: 'pnode' + (done ? ' done' : ''), 'data-search': ph.title.toLowerCase() });
      node.append(el('span', { class: 'pnum' }, done ? '✓' : String(ph.n).padStart(2, '0')));
      const card = el('div', { class: 'pcard', 'data-phase': ph.title, role: 'button', tabindex: '0' }, el('span', { class: 'ptitle' }, ph.title));
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
      const group = el('div', { class: `taskgroup ${state}`, id: `tg-${g.id}`, 'data-heading': g.heading });
      group.append(el('div', { class: 'tg-head' },
        el('span', { class: 'tg-title' }, g.heading),
        el('span', { class: `pill ${state}` }, pillText),
        el('span', { class: 'tg-meta' }, el('b', {}, `${g.done}/${g.total}`), ` · ${pct}%`),
      ));
      const rail = el('div', { class: `rail ${state}` });
      rail.append(el('span', { style: `width:${state === 'zero' ? 0 : pct}%` }));
      group.append(rail);
      const gd = currentDiff && currentDiff.perGroup.get(g.heading);
      const canReorder = editing && contiguous(g) && g.items.length > 1;
      const items = el('div', { class: 'items' });
      g.items.forEach((it, idx) => {
        const txt = el('span', { class: 'txt' }, it.text);
        if (editing && it.line != null) {
          txt.setAttribute('contenteditable', 'true');
          txt.setAttribute('spellcheck', 'false');
          txt.dataset.line = String(it.line);
          txt.dataset.orig = it.text;
        }
        let cls = 'item' + (it.checked ? ' on' : '');
        if (gd) { if (gd.added.has(it.text)) cls += ' d-add'; else if (gd.doneChanged.has(it.text)) cls += ' d-done'; }
        const row = el('div', { class: cls, 'data-search': it.text.toLowerCase(), 'data-line': it.line == null ? '' : String(it.line) },
          el('span', { class: 'chk' }, it.checked ? '✓' : ''),
          txt,
        );
        if (canReorder) {
          const up = el('button', { class: 'reorder', title: 'Move up' }, '↑');
          const down = el('button', { class: 'reorder', title: 'Move down' }, '↓');
          if (idx === 0) up.disabled = true;
          if (idx === g.items.length - 1) down.disabled = true;
          up.addEventListener('click', () => moveItem(g, idx, -1));
          down.addEventListener('click', () => moveItem(g, idx, 1));
          row.append(el('span', { class: 'reorder-ctl' }, up, down));
        }
        items.append(row);
      });
      if (gd) for (const r of gd.removed) {
        items.append(el('div', { class: 'item d-rem' },
          el('span', { class: 'chk' }, r.c ? '✓' : ''),
          el('span', { class: 'txt' }, r.t),
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
      for (const cmd of model.commands) pre.append(el('span', { class: 'cmdline', 'data-search': cmd.toLowerCase() }, el('span', { class: 'prompt' }, '$ '), cmd));
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
    let lastPhase = null;
    for (const blk of model.code) {
      if (blk.phaseTitle && blk.phaseTitle !== lastPhase) {
        cd.append(el('div', { class: 'subhead' }, blk.phaseTitle));
        lastPhase = blk.phaseTitle;
      }
      const wrap = el('div', { class: 'codeblock' });
      const bar = el('div', { class: 'codebar' }, el('span', { class: 'lang' }, blk.lang || 'text'));
      bar.append(copyBtn(() => blk.value));
      wrap.append(bar, el('pre', { class: 'code' }, el('code', { html: highlightCode(blk.value, blk.lang) })));
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
      const row = el('div', { class: 'file', 'data-search': fr.path.toLowerCase() }, filePath(fr.path));
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
      list.append(el('div', { class: 'oitem', 'data-search': h.title.toLowerCase(), style: `padding-left:${(h.depth - minDepth) * 1.1}rem` },
        el('span', { class: 'odepth' }, 'H' + h.depth),
        el('span', {}, h.title),
      ));
    }
    o.append(list);
    app.append(o);
    nav.push(['outline', 'Outline']);
  }

  // ---- Link pipeline cards to their task group ----
  const tgMap = new Map();
  app.querySelectorAll('.taskgroup[data-heading]').forEach(t => tgMap.set(t.getAttribute('data-heading'), t));
  app.querySelectorAll('.pcard[data-phase]').forEach(card => {
    const target = tgMap.get(card.getAttribute('data-phase'));
    if (!target) { card.removeAttribute('role'); card.removeAttribute('tabindex'); return; }
    card.classList.add('linked');
    card.append(el('span', { class: 'pgo' }, '→'));
    const go = () => {
      // expand the Tasks panel if collapsed, otherwise the target is display:none
      const sec = target.closest('section');
      if (sec && sec.classList.contains('collapsed')) { sec.classList.remove('collapsed'); persistCollapse(); }
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.remove('flash');
        void target.offsetWidth; // restart animation
        target.classList.add('flash');
      });
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  // ---- apply saved collapse state ----
  applyCollapsePrefs();

  // ---- Nav + collapse-all toggle ----
  navEl.innerHTML = '';
  for (const [id, label] of nav) navEl.append(el('a', { href: `#${id}` }, label));
  const collapsibles = () => [...app.querySelectorAll('section:not(.hero)')];
  const toggle = el('button', { class: 'toggle-all' }, 'collapse all');
  const sync = () => {
    const allClosed = collapsibles().every(s => s.classList.contains('collapsed'));
    toggle.textContent = allClosed ? 'expand all' : 'collapse all';
  };
  toggle.addEventListener('click', () => {
    const collapse = !collapsibles().every(s => s.classList.contains('collapsed'));
    collapsibles().forEach(s => s.classList.toggle('collapsed', collapse));
    persistCollapse();
    sync();
  });
  navEl.append(toggle);
  sync();
}

const searchEl = document.getElementById('search');

function applyFilter() {
  const q = (searchEl.value || '').trim().toLowerCase();
  app.querySelectorAll('[data-search]').forEach(r => {
    r.classList.toggle('hide', !!q && !r.getAttribute('data-search').includes(q));
  });
  // hide task groups with no visible items
  app.querySelectorAll('.taskgroup').forEach(g => {
    const anyVisible = [...g.querySelectorAll('.item')].some(i => !i.classList.contains('hide'));
    g.classList.toggle('hide', !!q && !anyVisible);
  });
  // hide whole sections (except hero) that have no visible rows
  app.querySelectorAll('section:not(.hero)').forEach(s => {
    const rows = s.querySelectorAll('[data-search]');
    if (!rows.length) { s.classList.toggle('dim', !!q); return; }
    const anyVisible = [...rows].some(r => !r.classList.contains('hide'));
    s.classList.toggle('hide', !!q && !anyVisible);
  });
  // expand collapsed sections while searching so matches are visible
  if (q) app.querySelectorAll('section.collapsed').forEach(s => s.classList.remove('collapsed'));
  document.body.classList.toggle('filtering', !!q);
}

searchEl.addEventListener('input', applyFilter);
searchEl.addEventListener('keydown', e => { if (e.key === 'Escape') { searchEl.value = ''; applyFilter(); searchEl.blur(); } });
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchEl) { e.preventDefault(); searchEl.focus(); }
});

async function load() {
  try {
    const model = BOOT ? BOOT.model : await fetch(`/model?i=${currentFile}`).then(r => r.json());
    currentModel = model;
    applyPending();
    await render(model);
    applyFilter();
    updateEditbar();
    statusEl.classList.remove('stale');
  } catch (e) {
    statusEl.classList.add('stale');
  }
}

if (!BOOT) {
  const es = new EventSource('/events');
  es.addEventListener('update', () => { statusEl.classList.add('stale'); load(); });
  es.onerror = () => statusEl.classList.add('stale');
} else {
  statusEl.classList.add('stale');
  const lbl = statusEl.querySelector('.label');
  if (lbl) lbl.textContent = 'demo';
}

initFiles().then(load);

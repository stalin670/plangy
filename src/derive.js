// Post-processing over the parsed model: computed stats, an actionable command
// list, the commit sequence, and best-effort phase dependencies. All pure.

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'console', '']);
const COMMITISH = /git\s+commit[^\n]*-m\s+["']([^"']+)["']/g;

export function deriveStats(model) {
  return {
    phases: model.phases.length,
    tasks: model.tasks.length,
    steps: model.tasks.reduce((a, t) => a + t.total, 0),
    done: model.tasks.reduce((a, t) => a + t.done, 0),
    files: model.files.length,
    code: model.code.length,
    tables: model.tables.length,
    diagrams: model.mermaid.length,
  };
}

function looksLikeCommand(line) {
  const t = line.trim();
  if (!t || t.startsWith('#')) return false;
  return /^(npm|npx|pnpm|yarn|node|git|cd|mkdir|rm|cp|mv|curl|wget|docker|python|pip|go|cargo|make|sh|bash|\.\/)/.test(t);
}

export function deriveCommands(model) {
  const commands = [];
  const seen = new Set();
  const add = (cmd) => {
    const c = cmd.trim();
    if (c && !seen.has(c)) { seen.add(c); commands.push(c); }
  };

  for (const run of model.runs) add(run.cmd);

  for (const block of model.code) {
    if (!SHELL_LANGS.has(block.lang)) continue;
    for (const line of block.value.split(/\r?\n/)) {
      if (looksLikeCommand(line)) add(line);
    }
  }

  const commits = [];
  for (const block of model.code) {
    let m;
    COMMITISH.lastIndex = 0;
    while ((m = COMMITISH.exec(block.value)) !== null) commits.push(m[1]);
  }

  return { commands, commits };
}

// Detect "after X" / "depends on X" references between phases. Matches a
// referenced phase by a case-insensitive substring of its title (e.g. "Task 2").
export function deriveDeps(model) {
  const titles = model.phases.map(p => p.title);
  const result = {};
  for (const phase of model.phases) {
    const hay = [phase.title, ...phase.steps.map(s => s.text)].join(' ');
    const deps = [];
    const re = /\b(?:after|depends on|requires|blocked by)\s+([A-Za-z][\w .#-]*?\d+|[A-Z][\w]+)/gi;
    let m;
    while ((m = re.exec(hay)) !== null) {
      const ref = m[1].trim();
      const match = titles.find(t => t !== phase.title && t.toLowerCase().includes(ref.toLowerCase()));
      if (match && !deps.includes(match)) deps.push(match);
    }
    if (deps.length) result[phase.title] = deps;
  }
  return result;
}

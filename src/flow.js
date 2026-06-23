function clean(s) {
  return String(s).replace(/["\n]/g, ' ').trim();
}

// Wrap a label onto multiple lines (mermaid <br/>) so long phase titles stay readable.
function wrap(label, width = 22) {
  const words = clean(label).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && (line.length + 1 + w.length) > width) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.join('<br/>');
}

// Choose the heading depth that best represents "phases": the most frequent
// depth (ties resolve to the shallowest). For a plan with one H1, two H2
// sections and eight H3 tasks, this picks the eight tasks as the pipeline and
// drops wrapper/meta headings like "Global Constraints" or "Self-Review".
function selectPhases(phases) {
  const counts = new Map();
  for (const p of phases) {
    const d = p.depth || 1;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  let bestDepth = null;
  for (const d of [...counts.keys()].sort((a, b) => a - b)) {
    if (bestDepth === null || counts.get(d) > counts.get(bestDepth)) bestDepth = d;
  }
  const selected = phases.filter(p => (p.depth || 1) === bestDepth);
  return selected.length >= 2 ? selected : phases;
}

export function phasesToMermaid(phases) {
  if (!phases || phases.length === 0) return 'flowchart TB\n  empty["No phases"]';

  const selected = selectPhases(phases);
  const lines = ['flowchart TB'];
  selected.forEach((p) => lines.push(`  ${p.id}["${wrap(p.title)}"]`));
  for (let i = 0; i < selected.length - 1; i++) {
    lines.push(`  ${selected[i].id} --> ${selected[i + 1].id}`);
  }
  return lines.join('\n');
}

// Structured pipeline for the custom (non-mermaid) flow renderer: the selected
// phases as ordered nodes, each enriched with its checklist step count and
// completion when a matching task group exists.
export function buildPipeline(phases, tasks = []) {
  if (!phases || phases.length === 0) return [];
  const byHeading = new Map(tasks.map(t => [t.heading, t]));
  return selectPhases(phases).map((p, i) => {
    const t = byHeading.get(p.title);
    return {
      n: i + 1,
      title: p.title,
      steps: t ? t.total : 0,
      done: t ? t.done : 0,
    };
  });
}

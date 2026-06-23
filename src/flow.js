function clean(s) {
  return String(s).replace(/["\n]/g, ' ').trim();
}

export function phasesToMermaid(phases) {
  if (!phases || phases.length === 0) return 'flowchart LR\n  empty[No phases]';
  const lines = ['flowchart LR'];
  phases.forEach((p) => lines.push(`  ${p.id}["${clean(p.title)}"]`));
  for (let i = 0; i < phases.length - 1; i++) {
    lines.push(`  ${phases[i].id} --> ${phases[i + 1].id}`);
  }
  return lines.join('\n');
}

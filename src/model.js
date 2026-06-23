import { parsePlan } from './parser.js';
import { phasesToMermaid, buildPipeline } from './flow.js';
import { deriveStats, deriveCommands, deriveDeps } from './derive.js';

// Compose the full view model from raw markdown. Pure: no fs/network, so it is
// shared by the live server and the static demo build.
export function composeModel(md, fileName) {
  const model = parsePlan(md);
  const deps = deriveDeps(model);
  const { commands, commits } = deriveCommands(model);
  const pipeline = buildPipeline(model.phases, model.tasks)
    .map(n => ({ ...n, deps: deps[n.title] || [] }));
  return {
    ...model,
    fileName,
    flow: phasesToMermaid(model.phases),
    pipeline,
    stats: deriveStats(model),
    commands,
    commits,
  };
}

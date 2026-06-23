# plangy — Design Spec

**Date:** 2026-06-23
**Status:** Approved (brainstorming)
**Owner:** ydamit5840@gmail.com

## Problem

Agents (Claude Code, codex, gemini, cursor) write a `plan.md` before implementing.
Almost nobody reads the plan top-to-bottom — it's plain text and slow to absorb.
Humans verify faster by *seeing* structure. If the plan is wrong, that's the cheapest
moment to catch it. `plangy` turns any `plan.md` into a visual the user can scan in
seconds, in a browser tab, refreshed live as the file changes.

## Goals (v1)

- Render `plan.md` as visuals in an auto-opened browser tab.
- Live-reload: editing the file (in editor or via agent) updates the tab instantly.
- Deterministic, offline, zero API keys, zero auth. Works on any markdown plan.
- Works with **any** agent — it just reads a file, agent-agnostic.
- One global install. Clean README on GitHub covering install + usage.

## Non-Goals (v1)

- Editing visuals in-browser and exporting updated `.md` (deferred to **v2**).
- LLM-powered understanding of prose (deterministic parse only).
- Per-agent native integrations beyond thin shell-out wrapper snippets.
- Browser e2e tests.

## Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| md→visual engine | Deterministic parse | Free, offline, instant, no API key |
| Platform | Standalone CLI | Universal across all agents; file-based |
| v1 scope | View-only + live reload | Ships fast, proves value, no write-back risk |
| Visuals | All 4 (flow, tasks, files, mermaid/tables) | Covers typical plan.md content |

## Architecture

```
plangy plan.md
   │
   ├─ Parser   markdown → PlanModel (phases, tasks, files, mermaid, tables, notes)
   ├─ Server   local http on 127.0.0.1:<port>, serves static SPA + model JSON
   ├─ Watcher  chokidar on the file → re-parse → push update over SSE
   └─ Browser  auto-opened tab renders model; re-renders on SSE push
```

Data flow is one-way (view-only), so there is no write-back path and no risk of
corrupting the user's `plan.md`.

### Stack

- **Runtime:** Node.js ≥ 18 (ESM, built-in `fetch`/SSE).
- **CLI args:** `commander`.
- **Markdown:** `unified` + `remark-parse` + `remark-gfm` (AST, not regex).
- **Watch:** `chokidar`.
- **Open browser:** `open`.
- **Transport:** built-in `http` + Server-Sent Events (no WebSocket lib).
- **Frontend:** vanilla HTML/CSS/JS + vendored `mermaid.min.js` (offline).

Rejected alt: single self-contained `.html` with no server — breaks live reload.
Rejected alt: WebSocket — overkill for one-way push; SSE is simpler.

## Parse Model

`PlanModel = { phases[], tasks[], files[], mermaid[], tables[], notes[] }`

**1. Phases / steps → flow diagram**
- `#`/`##` headings = phases; numbered lists / `###` under them = steps.
- Order = document order.
- Auto-generate a `flowchart LR` (mermaid) of phases→steps.
- Dependency heuristic: step text matching `after X` / `depends on` → edge; else sequential.

**2. Checklists → task progress**
- `- [ ]` / `- [x]` grouped under nearest heading.
- Per-group progress bar (done/total) + overall %. Card/table per item with state.

**3. File / change map**
- Detect file paths via: inline code spans matching path-like tokens (`src/foo.ts`,
  `*.py`), fenced-code info strings, and `file:` mentions.
- Collapsible tree; each leaf links back to the heading/step that referenced it.

**4. Mermaid + tables as-is**
- ` ```mermaid ` blocks rendered natively via mermaid.js.
- GFM tables rendered as styled HTML tables.

**Fallback / robustness**
- Unrecognized loose prose → "Notes" panel (nothing dropped).
- Empty file → friendly empty state.
- Missing a category (e.g. no checklists) → hide that panel.
- Malformed mermaid → inline error, does not crash the view.

### Layout

Single scroll page, 4 collapsible panels, sticky nav to jump between them.
Top bar: filename + live-reload status dot.

## CLI Surface

```
plangy <file>            # file defaults to plan.md
plangy plan.md --port 7331
plangy plan.md --no-open # don't auto-launch the tab
plangy --version | --help
```

- Auto-selects a free port if the chosen/default one is taken.
- Always prints the URL to the terminal as fallback.
- `Ctrl-C` cleanly stops server + watcher.

## Package Layout

```
plangy/
├─ package.json        # bin: { plangy: ./bin/cli.js }, type: module
├─ bin/cli.js          # arg parse → start server
├─ src/
│  ├─ parser.js        # AST → PlanModel  (pure, unit-tested)
│  ├─ server.js        # http + SSE + static
│  └─ watcher.js       # chokidar → SSE push
├─ web/
│  ├─ app.html
│  ├─ app.js           # render 4 panels from model JSON
│  ├─ app.css
│  └─ mermaid.min.js   # vendored (offline)
├─ test/               # parser unit tests against fixture plans
└─ README.md
```

## Install (README documents)

```
npm install -g plangy     # primary
npx plangy plan.md        # zero-install
```

Node ≥ 18. Cross-platform (`open` handles win/mac/linux).

**Optional agent wrappers** (README section, not v1 code): a one-line `/plangy`
Claude Code slash command + codex/cursor snippets that shell out to `plangy <file>`.
Delivers "works with any agent" without per-agent builds.

**README outline:** pitch ("nobody reads plan.md") → demo gif → install → usage →
md→visual mapping → agent integration snippets → roadmap (v2: inline edit + export) →
contributing / MIT license.

## Testing

- Parser is pure (`md string → PlanModel`) → unit-tested against fixture plans
  (real-world Claude/codex/gemini plan samples + edge cases: empty, no-checklist,
  malformed mermaid, prose-only).
- Server + watcher: smoke test (boot, serve, SSE push on change).
- No browser e2e in v1.

## Roadmap (post-v1)

- **v2:** inline edit of nodes/tasks in the browser → export updated `.md` to copy
  back to the agent (bidirectional md↔visual sync).
- Themes, export to PNG/SVG, multi-file plans.

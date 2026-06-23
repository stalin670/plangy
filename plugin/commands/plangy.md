---
description: Visualize the plan from the last response (or a given file) as live browser diagrams
argument-hint: "[path/to/plan.md]  (optional — uses the last response if omitted)"
allowed-tools: Bash(plangy:*), Bash(npx:*), Bash(ls:*), Bash(node:*), Glob, Read, Write
---

You are launching the **plangy** visualizer. plangy turns a markdown plan into live
browser visuals (flow diagram, task progress, file map, mermaid/tables).

## Step 1 — Find the plan to visualize

Resolve the source in this order:

1. **Explicit path** — if `$ARGUMENTS` is non-empty, treat it as a file path and use it directly. Skip to Step 3.
2. **A real file the last response just created** — if the most recent assistant message saved or referenced a markdown file that exists on disk (e.g. `plan.md`, `docs/.../plans/*.md`), prefer that actual file. Skip to Step 3 with it.
3. **The text of the last response** — otherwise, look at the **immediately preceding assistant message** in this conversation. Determine whether it contains a plan / markdown document, i.e. any of: markdown headings (`#`/`##`), numbered steps, task checklists (`- [ ]` / `- [x]`), tables, or ` ```mermaid ` blocks.
   - If it does, extract that markdown content (the plan portion of the response — strip pure conversational chatter, keep the structured plan).
   - If it does **not** contain any such plan/markdown content, go to **Step 4 (nothing found)**. Do not launch plangy.

## Step 2 — Write the last response to a temp file (only when using Step 1.3)

Create a folder `.plangy/` in the current working directory and write the extracted
markdown to `.plangy/last-plan.md` using the Write tool. (Mention to the user that
they can edit this file and the view will live-reload.)

## Step 3 — Launch plangy in the background

plangy runs a local web server and stays alive, so it MUST be launched as a
background process (run_in_background = true) — never foreground, that blocks the session.

Prefer the global CLI; fall back to npx if it is not on PATH:

- If `plangy` is available: `plangy "<file>"`
- Otherwise: `npx -y plangy "<file>"`

Then tell the user:
- Which source was used (the given file, the created file, or the captured last response).
- The local URL plangy logged (e.g. `http://127.0.0.1:7331`), and that it live-reloads.

Stop here.

## Step 4 — Nothing found (print exactly this, do NOT launch anything)

```
╭──────────────────────────────────────────────╮
│   📋  plangy — nothing to visualize           │
╰──────────────────────────────────────────────╯

The last response had no plan or markdown to render.
plangy visualizes plans — headings, steps, checklists,
tables, and diagrams.

Try one of:
  • Ask the agent to write a plan, then run /plangy
  • Point at a file directly:  /plangy path/to/plan.md
```

Do not summarize the plan's contents yourself — plangy is what visualizes it.

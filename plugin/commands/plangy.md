---
description: Visualize the plan from the last response (or a given file) as live browser diagrams
argument-hint: "[path/to/plan.md]  (optional - uses the last response if omitted)"
allowed-tools: Bash(plangy:*), Bash(npx:*), Bash(ls:*), Bash(node:*), Glob, Read, Write
---

You are launching the **plangy** visualizer. plangy turns a markdown plan into live
browser visuals (flow diagram, task progress, file map, mermaid/tables).

## Step 1 - Find the plan to visualize

Resolve the source in this order. **A real file on disk always wins over captured
chat text** - prefer a file whenever one exists.

1. **Explicit path** - if `$ARGUMENTS` is non-empty, treat it as a file path. Read it to
   confirm it exists and is non-empty, then go to **Step 2 (validate)** with it.
2. **A real file the last response created or referenced** - if the most recent assistant
   message saved or referenced a markdown file (e.g. `plan.md`, `docs/.../specs/*.md`,
   `docs/.../plans/*.md`), Read that path. If it exists and is non-empty, go to **Step 2**
   with it. This is the common **plan-mode** case: a plan written to disk is the source of
   truth - use the file, never a paraphrase of it.
   - If the referenced path does **not** exist yet (e.g. the write hasn't flushed, or the
     plan was only shown in the approval UI and never saved), say so and ask the user to
     re-run `/plangy <path>` once the file is written. Do **not** fall back to capturing
     chat text in this case - that is what produces a blank tab.
3. **The text of the last response** - only if no file is involved at all. Look at the
   **immediately preceding assistant message**. It qualifies only if, *after stripping
   conversational chatter*, what remains contains real plan structure: markdown headings
   (`#`/`##`), numbered steps, task checklists (`- [ ]` / `- [x]`), a table, or a
   ` ```mermaid ` block. A message that merely *mentions* or *links* a plan (e.g. "I wrote
   the plan to ...") is **not** a plan - it has no structure to render → go to
   **Step 4 (nothing found)**.

## Step 2 - Validate the source has renderable content

Before launching, the chosen source MUST contain at least one plan signal: a markdown
heading, a numbered step, a checklist item, a table row, or a mermaid block. Read the
file (or inspect the extracted text) and confirm.

- If it has **no** such structure (empty file, or only prose/links), go to
  **Step 4 (nothing found)**. Do not launch - plangy would render a near-blank
  "Overview / No phases" page, which is the empty-tab symptom.
- For the Step 1.3 case: create a folder `.plangy/` in the current working directory and
  write the extracted markdown to `.plangy/last-plan.md` (Write tool). Then re-read it to
  confirm it is non-empty and still has structure. If the write came out empty, delete it
  and go to Step 4. Mention the user can edit `.plangy/last-plan.md` and the view live-reloads.

## Step 3 - Launch plangy in the background

plangy runs a local web server and stays alive, so it MUST be launched as a
background process (run_in_background = true) - never foreground, that blocks the session.

Prefer the global CLI; fall back to npx if it is not on PATH:

- If `plangy` is available: `plangy "<file>"`
- Otherwise: `npx -y plangy "<file>"`

Then tell the user:
- Which source was used (the given file, the created file, or the captured last response).
- The local URL plangy logged (e.g. `http://127.0.0.1:7331`), and that it live-reloads.

Stop here.

## Step 4 - Nothing found (print exactly this, do NOT launch anything)

```
╭──────────────────────────────────────────────╮
│   📋  plangy - nothing to visualize           │
╰──────────────────────────────────────────────╯

The last response had no plan or markdown to render.
plangy visualizes plans - headings, steps, checklists,
tables, and diagrams.

Try one of:
  • Ask the agent to write a plan, then run /plangy
  • Point at a file directly:  /plangy path/to/plan.md
```

Do not summarize the plan's contents yourself - plangy is what visualizes it.

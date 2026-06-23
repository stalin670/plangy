---
description: Open the current implementation plan as live visuals in the browser (via the plangy CLI)
argument-hint: "[path/to/plan.md]  (optional — auto-detects if omitted)"
allowed-tools: Bash(plangy:*), Bash(npx:*), Bash(ls:*), Bash(node:*), Glob, Read
---

You are launching the **plangy** visualizer for a markdown implementation plan.

## Step 1 — Determine the plan file

- If `$ARGUMENTS` is non-empty, treat it as the plan file path. Use it directly.
- Otherwise, auto-detect the plan the agent most likely just produced, in this priority order:
  1. `./plan.md` in the current working directory, if it exists.
  2. The most **recently modified** markdown file under any `plans/` or `specs/` directory (e.g. `docs/superpowers/plans/*.md`). Use Glob to find candidates, then pick the newest by modification time.
  3. The most recently modified file whose name contains `plan` and ends in `.md`.
- If nothing is found, tell the user no plan file was located and ask them to pass a path: `/plangy path/to/plan.md`. Do NOT guess a random markdown file.

Briefly confirm which file you chose (one line).

## Step 2 — Launch plangy in the background

`plangy` starts a local web server and stays running, so it MUST be launched as a background process (never foreground — that would block the session).

Prefer the globally installed CLI; if it is not on PATH, fall back to `npx`:

- If `plangy` is available: `plangy "<chosen-file>"`
- Otherwise: `npx -y plangy "<chosen-file>"`

(Use the Bash tool with run_in_background set to true.)

## Step 3 — Report

- Tell the user the visualizer is opening in their browser, and print the local URL plangy logged (e.g. `http://127.0.0.1:7331`).
- Remind them it live-reloads: editing the plan file updates the tab automatically.
- If launching fails because Node is missing, tell them plangy requires Node >= 18.

Do not summarize the plan's contents yourself — plangy is what visualizes it.

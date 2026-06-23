<div align="center">

# plangy

**Nobody reads `plan.md`. plangy turns it into a picture you scan in seconds.**

[![npm version](https://img.shields.io/npm/v/plangy.svg)](https://www.npmjs.com/package/plangy)
[![npm downloads](https://img.shields.io/npm/dm/plangy.svg)](https://www.npmjs.com/package/plangy)
[![node](https://img.shields.io/node/v/plangy.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/plangy.svg)](./LICENSE)

</div>

AI agents (Claude Code, codex, cursor, gemini) write an implementation `plan.md` before they touch code — but humans skim those plain-text files instead of reading them. A diagram is scanned in seconds, so a missing step or a wrong file reference jumps out **before** any code gets written. plangy catches plan mistakes early, while they're still cheap to fix.

Point it at any markdown plan and it opens a browser tab with the plan rendered as a flow diagram, task-progress bars, a file map, and native charts/tables — auto-refreshing as you edit the file.

---

## Contents

- [Demo](#demo)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Usage](#usage)
- [What it shows](#what-it-shows)
- [Use with any agent](#use-with-any-agent)
- [How it works](#how-it-works)
- [Updating](#updating)
- [Uninstalling](#uninstalling)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Demo

<!-- Record `plangy examples/plan.md` and drop the file at docs/demo.gif, then uncomment:
![plangy demo](docs/demo.gif)
-->

_Demo gif coming soon._ For now, run `plangy examples/plan.md` after installing — the bundled example shows every panel.

## Features

- 📊 **Flow diagram** — headings + numbered steps become a left-to-right pipeline.
- ✅ **Task progress** — `- [ ]` / `- [x]` checklists become progress bars with done/total counts.
- 🗂️ **File map** — file paths in the plan are collected into a tree, each linked to the phase that mentions it.
- 📈 **Native rendering** — existing ` ```mermaid ` blocks and markdown tables render as real charts/tables.
- 🔁 **Live reload** — edit the file in your editor or via your agent; the tab updates instantly.
- 🔌 **Agent-agnostic** — it just reads a file, so it works with any tool that writes a plan.
- 🛡️ **Offline & safe** — deterministic parse, no LLM, no API keys, no network, and it **never writes to your file**.

## Requirements

- [Node.js](https://nodejs.org) **>= 18**
- A modern browser (anything from the last few years)

Check your Node version:

```bash
node --version
```

## Installation

### Global (recommended)

Install once, use everywhere:

```bash
npm install -g plangy
```

Verify it installed:

```bash
plangy --version
```

### Zero-install (npx)

Run it without installing anything:

```bash
npx plangy plan.md
```

### Other package managers

```bash
pnpm add -g plangy     # pnpm
yarn global add plangy # yarn
```

## Quick start

```bash
# render the plan in the current folder
plangy

# or point at any file
plangy path/to/plan.md

# try the bundled example (shows every panel)
plangy examples/plan.md
```

A browser tab opens at `http://127.0.0.1:7331`. Leave it open — it refreshes itself whenever the file changes. Press `Ctrl-C` in the terminal to stop.

## Usage

```
plangy [file]

Arguments:
  file               markdown plan file (default: "plan.md")

Options:
  -p, --port <port>  preferred port (default: 7331; auto-picks the next free port if busy)
  --no-open          do not auto-open the browser tab
  -V, --version      print the version
  -h, --help         show help
```

Examples:

```bash
plangy                          # render ./plan.md
plangy docs/feature-plan.md     # render a specific file
plangy plan.md --port 8080      # use a specific port
plangy plan.md --no-open        # don't auto-open; just print the URL
```

## What it shows

| Markdown element                          | Visual                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| Headings + numbered steps                 | Left-to-right flow diagram (mermaid)                       |
| `- [ ]` / `- [x]` checklists              | Progress bars + grouped task list with done/total counts   |
| Inline-code file paths (`src/server.js`)  | File/change map listing which phase references each file   |
| ` ```mermaid ` blocks and GFM tables      | Rendered natively as charts and styled tables              |
| Loose prose with no heading               | A "Notes" panel (nothing is ever dropped)                  |

## Use with any agent

plangy just reads a markdown file, so it works with anything that writes one — Claude Code, Codex, Cursor, Gemini, or your own scripts. The terminal command works everywhere:

```bash
plangy plan.md          # or: npx plangy plan.md
```

The richer `/plangy` slash command (visualize the plan from your last response) is available as a **Claude Code plugin** below. For other agents, use the CLI directly.

### Claude Code — install the `/plangy` plugin

This adds a `/plangy` command and lists plangy under `/plugins`.

**1. Add the marketplace** (one time — registers where to find the plugin):

```
/plugin marketplace add stalin670/plangy
```

**2. Install the plugin** (`plugin-name@marketplace-name`):

```
/plugin install plangy@plangy
```

**3. Reload** so the command registers:

```
/reload-plugins
```

> Prefer a menu? Just type `/plugin` → **Browse marketplaces** → **plangy** → **Install**.

Now use it after any response that contains a plan:

```
/plangy                 # visualizes the plan from the last response
/plangy path/to/plan.md # or point at a specific file
```

With no argument, `/plangy` visualizes the plan in the **last response**: if that response saved a real `.md` file it uses it, otherwise it captures the response's markdown to `.plangy/last-plan.md` and renders that (edit the file and the view live-reloads). If the last response has no plan/markdown, it shows a short "nothing to visualize" message instead of launching. It uses your global `plangy` install if present, otherwise falls back to `npx`.

**Updating the plugin later:**

```
/plugin marketplace update plangy
/plugin update plangy@plangy
```

### Codex — run after the plan is written

Codex has no Claude-style plugin marketplace, so use the CLI. After Codex writes the plan, run in your terminal:

```bash
plangy plan.md
```

Or wire it into your workflow with a shell alias / task so it runs automatically once the plan file is saved.

### Cursor, Gemini, and others

Same pattern — these agents write a plan file, then you run the CLI:

```bash
plangy plan.md          # installed globally
npx plangy plan.md      # or zero-install
```

If your agent supports custom commands or hooks, point one at `plangy plan.md` so a single keystroke opens the visualizer after the plan is written.

### Manual slash command (no plugin install)

Don't want to install the plugin? Drop the command in by hand. Create `.claude/commands/plangy.md` (per-project) or `~/.claude/commands/plangy.md` (personal, all projects) containing a prompt that runs `plangy plan.md`.

## How it works

1. plangy parses your markdown **deterministically** — no LLM, no API keys.
2. The parse becomes a structured model of phases, steps, tasks, files, tables, and notes.
3. A local server starts on `127.0.0.1` (default port `7331`).
4. Your browser renders the model as collapsible panels.
5. A file watcher pushes updates to the tab over Server-Sent Events (live reload).

It runs fully offline and the data flow is one-way: plangy reads your file and never writes back to it.

## Updating

```bash
npm install -g plangy@latest
```

## Uninstalling

```bash
npm uninstall -g plangy
```

## Troubleshooting

**`plangy: command not found` after install**
Your global npm bin folder isn't on `PATH`. Find it with `npm bin -g` and add that folder to your `PATH`, or use `npx plangy` instead.

**Port already in use**
plangy auto-picks the next free port. To force one, use `--port`, e.g. `plangy plan.md --port 8080`.

**Browser didn't open**
Some environments block auto-open. The URL is always printed in the terminal — open it manually, or pass `--no-open` and copy the link.

**Mermaid block shows an error**
The diagram syntax in your plan is invalid. plangy shows the error inline instead of crashing the whole view — fix the mermaid block in your `.md`.

## Roadmap

- **v2** — edit the visuals in-browser and export an updated `.md` to hand back to the agent (two-way sync).
- Themes, PNG/SVG export, and multi-file plans.

## Contributing

Contributions are welcome. Tests run with Node's built-in test runner:

```bash
git clone https://github.com/stalin670/plangy.git
cd plangy
npm install
npm test
```

Open an issue or PR at [github.com/stalin670/plangy](https://github.com/stalin670/plangy).

## License

[MIT](./LICENSE) © plangy contributors

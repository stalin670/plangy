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

plangy just reads a markdown file, so it works with anything that writes one — Claude Code, codex, cursor, gemini, or your own scripts. After your agent writes the plan, run:

```bash
plangy plan.md
```

### Claude Code plugin (`/plangy`)

Install the plugin so `/plangy` is a built-in command that finds the latest plan and opens it:

```
/plugin marketplace add stalin670/plangy
/plugin install plangy@plangy
```

Then, after your agent writes a plan, just type:

```
/plangy                 # auto-detects the latest plan file
/plangy path/to/plan.md # or point at a specific file
```

It auto-detects the freshest plan (`./plan.md`, then the newest file under `plans/`/`specs/`, then any `*plan*.md`), launches plangy in the background, and prints the URL. It uses your global `plangy` install if present, otherwise falls back to `npx`.

> Prefer not to install the plugin? You can drop the same command in manually: create `.claude/commands/plangy.md` (per-project) or `~/.claude/commands/plangy.md` (personal, all projects) with a prompt that runs `plangy plan.md`.

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

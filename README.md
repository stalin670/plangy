# plangy

Nobody reads `plan.md`. plangy turns it into a picture you scan in seconds.

## Demo

![plangy demo](docs/demo.gif)

> A short demo gif goes here. Drop a recording at `docs/demo.gif`.

## Why

AI agents write an implementation plan before they touch code, but humans skim those plain-text `plan.md` files instead of reading them top to bottom. A diagram is scanned in seconds, so a missing step or a wrong file reference jumps out before any code gets written. plangy catches plan mistakes early, while they're still cheap to fix.

## Install

```bash
npm install -g plangy
```

Or run it with zero install:

```bash
npx plangy plan.md
```

Requires Node >= 18.

## Usage

```
plangy [file]            # file defaults to plan.md
  -p, --port <port>      # preferred port (default 7331; auto-picks next free if busy)
  --no-open              # do not auto-open the browser tab
  -V, --version
  -h, --help
```

Quick start with the bundled example:

```bash
plangy examples/plan.md
```

## What it shows

| Markdown element                          | Visual                                                              |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Headings + numbered steps                 | Left-to-right flow diagram (mermaid)                               |
| `- [ ]` / `- [x]` checklists              | Progress bars + grouped task list with done/total counts          |
| Inline code file paths (`src/server.js`)  | File/change map listing which phase references each file          |
| ` ```mermaid ` blocks and GFM tables      | Rendered natively                                                  |
| Loose prose with no heading               | A "Notes" panel (nothing is dropped)                              |

## Use with any agent

plangy just reads a markdown file, so it works with any agent that writes one: Claude Code, codex, cursor, gemini, or anything else.

After your agent writes the plan, run `plangy plan.md` in your terminal.

For Claude Code, you can add a slash command. Create `.claude/commands/plangy.md`:

```markdown
Run `plangy plan.md` in the terminal to open the live plan visualizer.
```

## How it works

1. plangy parses your markdown deterministically (no LLM, no API keys).
2. The parse becomes a structured model of phases, steps, tasks, files, tables, and notes.
3. A local server starts on `127.0.0.1` (default port 7331).
4. Your browser renders the model as panels.
5. Editing the file pushes an update to the tab instantly over SSE (live reload).

It runs fully offline, needs no API keys, and the data flow is one-way: plangy never writes to your file.

## Roadmap

- **v2:** edit the visuals in-browser and export an updated `.md` to hand back to the agent.

## Contributing

Contributions are welcome. Tests run with Node's built-in test runner:

```bash
npm test
```

## License

MIT

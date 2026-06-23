#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Resolve the argument list into a flat list of markdown files. A single
// directory argument expands to the .md files inside it (sorted).
function resolveFiles(args) {
  if (args.length === 1 && existsSync(args[0]) && statSync(args[0]).isDirectory()) {
    const dir = args[0];
    return readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.md'))
      .sort()
      .map(f => path.join(dir, f));
  }
  return args;
}

const program = new Command();
program
  .name('plangy')
  .description('Turn any plan.md into live-reloading visuals in your browser.')
  .version(pkg.version)
  .argument('[files...]', 'markdown plan file(s), or a directory of .md files', ['plan.md'])
  .option('-p, --port <port>', 'preferred port', '7331')
  .option('--no-open', 'do not auto-open the browser tab')
  .action(async (args, opts) => {
    const files = resolveFiles(args);
    if (!files.length) {
      console.error('No markdown files found.');
      process.exit(1);
    }
    const { startServer } = await import('../src/server.js');
    const srv = await startServer({ files, port: opts.port, openBrowser: opts.open });
    console.log(`plangy serving ${files.length} file${files.length === 1 ? '' : 's'} → ${srv.url}`);
    console.log('Watching for changes. Ctrl-C to stop.');
    process.on('SIGINT', async () => { await srv.close(); process.exit(0); });
  });

program.parse();

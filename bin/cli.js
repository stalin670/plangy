#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();
program
  .name('plangy')
  .description('Turn any plan.md into live-reloading visuals in your browser.')
  .version(pkg.version)
  .argument('[file]', 'markdown plan file', 'plan.md')
  .option('-p, --port <port>', 'preferred port', '7331')
  .option('--no-open', 'do not auto-open the browser tab')
  .action(async (file, opts) => {
    const { startServer } = await import('../src/server.js');
    const srv = await startServer({
      file,
      port: opts.port,
      openBrowser: opts.open,
    });
    console.log(`plangy serving ${file} → ${srv.url}`);
    console.log('Watching for changes. Ctrl-C to stop.');
    process.on('SIGINT', async () => { await srv.close(); process.exit(0); });
  });

program.parse();

#!/usr/bin/env node
import { loadConfig } from './config.js';
import { AutotuneDb } from './storage/sqlite.js';
import { ingestTraces } from './ingest/trace-reader.js';
import { getRubrics } from './eval/rubrics.js';
import { runEval } from './eval/runner.js';
import { runOptimize } from './optimize/runner.js';
import { promoteOrRollbackCanary } from './packs/deployer.js';
import { runDaemon, runOnce } from './daemon.js';
import { runBehaviorTuning } from './behavior/runner.js';
import { runInit } from './init.js';

type ParsedArgs = {
  cmd: string;
  configPath?: string;
  force: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  let configPath: string | undefined;
  let force = false;
  let help = false;
  let cmd = '';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--config' || arg === '-c') {
      configPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (!cmd) {
      cmd = arg;
    }
  }

  return { cmd: cmd || 'once', configPath, force, help };
}

function printHelp(): void {
  console.log(`autotune <command> [options]

Commands:
  init        Interactive setup (writes config file)
  ingest      Ingest traces
  eval        Evaluate traces
  optimize    Generate prompt packs
  deploy      Promote or roll back canaries
  behavior    Run behavior tuning
  once        Run full pipeline once (default)
  daemon      Run continuous daemon loop

Options:
  -c, --config <path>   Use a specific config file
  --force               Overwrite config during init
  -h, --help            Show help
`);
}

function ensureApiKey(config: { openrouter: { apiKey: string } }, action: string): boolean {
  if (config.openrouter.apiKey) return true;
  console.warn(`[autotune] OPENROUTER_API_KEY missing; skipping ${action}.`);
  return false;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  if (parsed.cmd === 'init') {
    const configPath = await runInit({ configPath: parsed.configPath, force: parsed.force });
    console.log(`Wrote config to ${configPath}`);
    return;
  }

  const config = loadConfig(parsed.configPath);
  const db = new AutotuneDb(config.dbPath);

  switch (parsed.cmd) {
    case 'ingest': {
      const result = ingestTraces(db, config);
      console.log(`Ingested ${result.ingested} traces from ${result.files} files.`);
      return;
    }
    case 'eval': {
      if (!ensureApiKey(config, 'eval')) return;
      const rubrics = getRubrics().filter(r => config.behaviors.includes(r.behavior));
      const result = await runEval({ db, config, rubrics });
      console.log(`Evaluated ${result.evaluated} traces.`);
      return;
    }
    case 'optimize': {
      if (!ensureApiKey(config, 'optimize')) return;
      for (const behavior of config.behaviors) {
        const pack = await runOptimize({ db, config, behavior });
        if (pack) {
          console.log(`Generated pack for ${behavior}: ${pack.version}`);
        }
      }
      return;
    }
    case 'deploy': {
      for (const behavior of config.behaviors) {
        promoteOrRollbackCanary({ db, config, behavior });
      }
      console.log('Deployment checks complete.');
      return;
    }
    case 'behavior': {
      const result = await runBehaviorTuning({ db, config, force: true });
      if (result?.reportPath) {
        console.log(`Behavior tuning complete. Report: ${result.reportPath}`);
      } else {
        console.log('Behavior tuning complete.');
      }
      return;
    }
    case 'daemon': {
      await runDaemon(parsed.configPath);
      return;
    }
    case 'once':
    default: {
      await runOnce(parsed.configPath);
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

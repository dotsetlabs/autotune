#!/usr/bin/env node
import { loadConfig } from './config.js';
import { AutotuneDb } from './storage/sqlite.js';
import { ingestTraces } from './ingest/trace-reader.js';
import { getRubrics } from './eval/rubrics.js';
import { runEval } from './eval/runner.js';
import { runOptimize } from './optimize/runner.js';
import { deployPromptPack, promoteOrRollbackCanary } from './packs/deployer.js';
import { runDaemon, runOnce } from './daemon.js';

async function main(): Promise<void> {
  const cmd = process.argv[2] || 'once';
  const config = loadConfig();
  const db = new AutotuneDb(config.dbPath);

  switch (cmd) {
    case 'ingest': {
      const result = ingestTraces(db, config);
      console.log(`Ingested ${result.ingested} traces from ${result.files} files.`);
      return;
    }
    case 'eval': {
      const rubrics = getRubrics().filter(r => config.behaviors.includes(r.behavior));
      const result = await runEval({ db, config, rubrics });
      console.log(`Evaluated ${result.evaluated} traces.`);
      return;
    }
    case 'optimize': {
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
    case 'daemon': {
      await runDaemon();
      return;
    }
    case 'once':
    default: {
      await runOnce();
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

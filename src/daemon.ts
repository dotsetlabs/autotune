import { loadConfig } from './config.js';
import { AutotuneDb } from './storage/sqlite.js';
import { ingestTraces } from './ingest/trace-reader.js';
import { getRubrics } from './eval/rubrics.js';
import { runEval } from './eval/runner.js';
import { runOptimize } from './optimize/runner.js';
import { deployPromptPack, promoteOrRollbackCanary } from './packs/deployer.js';
import { logAlert } from './monitor/alerts.js';
import { runBehaviorTuning } from './behavior/runner.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runOnce(configPath?: string): Promise<void> {
  const config = loadConfig(configPath);
  const db = new AutotuneDb(config.dbPath);

  ingestTraces(db, config);
  await runBehaviorTuning({ db, config });

  if (!config.openrouter.apiKey) {
    logAlert('OPENROUTER_API_KEY missing; skipping eval/optimize.');
    for (const behavior of config.behaviors) {
      promoteOrRollbackCanary({ db, config, behavior });
    }
    return;
  }

  const rubrics = getRubrics().filter(rubric => config.behaviors.includes(rubric.behavior));
  await runEval({ db, config, rubrics });

  for (const behavior of config.behaviors) {
    const pack = await runOptimize({ db, config, behavior });
    if (pack) {
      deployPromptPack({ db, config, pack });
    }
    promoteOrRollbackCanary({ db, config, behavior });
  }
}

export async function runDaemon(configPath?: string): Promise<void> {
  logAlert('Autotune daemon started');
  while (true) {
    try {
      await runOnce(configPath);
    } catch (err) {
      logAlert(`Autotune daemon error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const config = loadConfig(configPath);
    await sleep(config.intervalMinutes * 60 * 1000);
  }
}

import fs from 'fs';
import path from 'path';
import { AutotuneConfig } from '../config.js';
import { AutotuneDb } from '../storage/sqlite.js';
import { PromptPack } from '../types.js';
import { serializePromptPack } from './format.js';
import { getAverageScoreForPack } from '../monitor/metrics.js';

const behaviorMetric: Record<string, string> = {
  'task-extraction': 'task_extraction',
  'response-quality': 'response_quality'
};

function writeFileAtomic(targetPath: string, contents: string): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${targetPath}.tmp`;
  fs.writeFileSync(tempPath, contents);
  fs.renameSync(tempPath, targetPath);
}

function readPack(filePath: string): PromptPack | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PromptPack;
    return raw;
  } catch {
    return null;
  }
}

export function deployPromptPack(params: {
  db: AutotuneDb;
  config: AutotuneConfig;
  pack: PromptPack;
}): void {
  const outputDir = params.config.deploy.outputDir;
  const behavior = params.pack.behavior;
  const metric = behaviorMetric[behavior] || 'response_quality';
  const canaryPct = Math.round(params.config.deploy.canaryFraction * 100);

  if (params.config.deploy.canaryFraction < 1) {
    const canaryPath = path.join(outputDir, `${behavior}.canary.json`);
    const metadata = {
      ...(params.pack.metadata || {}),
      canaryPercent: canaryPct,
      canarySince: new Date().toISOString()
    };
    const canaryPack: PromptPack = { ...params.pack, metadata };
    writeFileAtomic(canaryPath, serializePromptPack(canaryPack));
    params.db.deployPromptPack({ packId: params.pack.version, target: canaryPath, status: 'canary', canaryPct });
    return;
  }

  const targetPath = path.join(outputDir, `${behavior}.json`);
  writeFileAtomic(targetPath, serializePromptPack(params.pack));
  params.db.deployPromptPack({ packId: params.pack.version, target: targetPath, status: 'full', canaryPct: 100 });
}

export function promoteOrRollbackCanary(params: {
  db: AutotuneDb;
  config: AutotuneConfig;
  behavior: string;
}): { action: 'promoted' | 'rolled_back' | 'waiting' | 'none' } {
  const outputDir = params.config.deploy.outputDir;
  const canaryPath = path.join(outputDir, `${params.behavior}.canary.json`);
  const activePath = path.join(outputDir, `${params.behavior}.json`);
  const canaryPack = readPack(canaryPath);
  if (!canaryPack) return { action: 'none' };

  const metric = behaviorMetric[params.behavior] || 'response_quality';
  const canaryStats = getAverageScoreForPack({
    db: params.db,
    behavior: params.behavior,
    version: canaryPack.version,
    metric
  });

  if (canaryStats.count < params.config.deploy.canaryMinSamples) {
    return { action: 'waiting' };
  }

  const activePack = readPack(activePath);
  const activeStats = activePack
    ? getAverageScoreForPack({ db: params.db, behavior: params.behavior, version: activePack.version, metric })
    : { average: 0, count: 0 };

  if (!activePack) {
    writeFileAtomic(activePath, serializePromptPack(canaryPack));
    params.db.deployPromptPack({ packId: canaryPack.version, target: activePath, status: 'promoted', canaryPct: 100 });
    fs.unlinkSync(canaryPath);
    return { action: 'promoted' };
  }

  if (canaryStats.average - activeStats.average >= params.config.deploy.canaryMinImprovement) {
    writeFileAtomic(activePath, serializePromptPack(canaryPack));
    params.db.deployPromptPack({ packId: canaryPack.version, target: activePath, status: 'promoted', canaryPct: 100 });
    fs.unlinkSync(canaryPath);
    return { action: 'promoted' };
  }

  if (activeStats.average - canaryStats.average >= params.config.deploy.canaryMinImprovement) {
    fs.unlinkSync(canaryPath);
    params.db.deployPromptPack({ packId: canaryPack.version, target: canaryPath, status: 'rolled_back', canaryPct: 0 });
    return { action: 'rolled_back' };
  }

  return { action: 'waiting' };
}

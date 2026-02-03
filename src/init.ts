import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { getDefaultConfigPath, loadConfig } from './config.js';
import type { AutotuneConfig } from './config.js';

export type InitOptions = {
  configPath?: string;
  force?: boolean;
};

function ensureDir(dir: string): void {
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
}

function setModeSafe(filePath: string, mode: number): void {
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // best-effort
  }
}

function mask(value: string | undefined): string {
  if (!value) return 'missing';
  if (value.length <= 6) return 'set';
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

function prompt(rl: readline.Interface, question: string, fallback?: string): Promise<string> {
  const label = fallback ? `${question} [${fallback}]: ` : `${question}: `;
  return new Promise(resolve => {
    rl.question(label, answer => {
      const trimmed = answer.trim();
      resolve(trimmed || fallback || '');
    });
  });
}

async function promptYesNo(rl: readline.Interface, question: string, fallback = false): Promise<boolean> {
  const defaultLabel = fallback ? 'yes' : 'no';
  const answer = await prompt(rl, `${question} (yes/no)`, defaultLabel);
  return ['y', 'yes', 'true', '1', 'on'].includes(answer.toLowerCase());
}

export async function runInit(options: InitOptions = {}): Promise<string> {
  const configPath = options.configPath || getDefaultConfigPath();
  const existing = fs.existsSync(configPath);

  if (existing && !options.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const overwrite = await promptYesNo(rl, `Config already exists at ${configPath}. Overwrite?`, false);
    rl.close();
    if (!overwrite) {
      return configPath;
    }
  }

  const defaults = loadConfig(configPath);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const apiKeyPrompt = defaults.openrouter.apiKey
    ? `OpenRouter API key [current: ${mask(defaults.openrouter.apiKey)}]`
    : 'OpenRouter API key';
  const apiKeyInput = await prompt(rl, apiKeyPrompt);
  const baseUrl = await prompt(rl, 'OpenRouter base URL', defaults.openrouter.baseUrl);
  const traceDir = await prompt(rl, 'Trace directory', defaults.traceDir);
  const outputDir = await prompt(rl, 'Prompt pack output directory', defaults.deploy.outputDir);
  const dbPath = await prompt(rl, 'Autotune database path', defaults.dbPath);
  const behaviorsInput = await prompt(rl, 'Behaviors (comma-separated)', defaults.behaviors.join(', '));
  const intervalInput = await prompt(rl, 'Interval minutes', String(defaults.intervalMinutes));

  const enableBehavior = await promptYesNo(rl, 'Enable behavior tuning', defaults.behavior.enabled);
  let behaviorConfigPath = defaults.behavior.configPath;
  let behaviorReportDir = defaults.behavior.reportDir;
  let behaviorPromptPacks = defaults.behavior.promptPacks;
  let behaviorEvalModel = defaults.behavior.evalModel || '';
  let behaviorEvalSamples = defaults.behavior.evalSamples;
  let behaviorWindowDays = defaults.behavior.windowDays;
  let behaviorCanaryPercent = defaults.behavior.canaryPercent;

  if (enableBehavior) {
    behaviorConfigPath = await prompt(rl, 'Behavior config path', behaviorConfigPath);
    behaviorReportDir = await prompt(rl, 'Behavior report directory', behaviorReportDir);
    behaviorPromptPacks = await promptYesNo(rl, 'Enable behavior prompt packs', behaviorPromptPacks);
    behaviorEvalModel = await prompt(rl, 'Behavior eval model (optional)', behaviorEvalModel || '');
    behaviorEvalSamples = parseInt(await prompt(rl, 'Behavior eval samples', String(behaviorEvalSamples)), 10) || behaviorEvalSamples;
    behaviorWindowDays = parseInt(await prompt(rl, 'Behavior window days', String(behaviorWindowDays)), 10) || behaviorWindowDays;
    behaviorCanaryPercent = parseInt(await prompt(rl, 'Behavior canary percent', String(behaviorCanaryPercent)), 10) || behaviorCanaryPercent;
  }

  const redact = await promptYesNo(rl, 'Enable redaction', defaults.redact);

  rl.close();

  const behaviors = behaviorsInput
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const config: AutotuneConfig = {
    ...defaults,
    openrouter: {
      ...defaults.openrouter,
      apiKey: apiKeyInput || defaults.openrouter.apiKey,
      baseUrl
    },
    traceDir,
    dbPath,
    intervalMinutes: parseInt(intervalInput, 10) || defaults.intervalMinutes,
    behaviors: behaviors.length > 0 ? behaviors : defaults.behaviors,
    redact,
    deploy: {
      ...defaults.deploy,
      outputDir
    },
    behavior: {
      ...defaults.behavior,
      enabled: enableBehavior,
      configPath: behaviorConfigPath,
      reportDir: behaviorReportDir,
      promptPacks: behaviorPromptPacks,
      evalModel: behaviorEvalModel || undefined,
      evalSamples: behaviorEvalSamples,
      windowDays: behaviorWindowDays,
      canaryPercent: behaviorCanaryPercent
    }
  };

  ensureDir(path.dirname(configPath));
  ensureDir(path.dirname(dbPath));
  ensureDir(traceDir);
  ensureDir(outputDir);
  ensureDir(behaviorReportDir);
  ensureDir(path.dirname(behaviorConfigPath));

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  setModeSafe(configPath, 0o600);

  return configPath;
}

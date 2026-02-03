import fs from 'fs';
import path from 'path';

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  minRetryDelayMs: number;
  maxRetryDelayMs: number;
}

export interface JudgeConfig {
  stage1Model: string;
  stage2Model: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface OptimizeConfig {
  minImprovement: number;
  maxFailuresSample: number;
  maxCandidates: number;
  sampleSize: number;
  candidateModel: string;
  rerankModel: string;
  predictorModel: string;
}

export interface DeployConfig {
  outputDir: string;
  canaryFraction: number;
  canaryMinSamples: number;
  canaryMinImprovement: number;
}

export interface BehaviorTuningConfig {
  enabled: boolean;
  windowDays: number;
  minTraces: number;
  maxTraces: number;
  evalModel?: string;
  evalSamples: number;
  promptPacks: boolean;
  canaryPercent: number;
  reportDir: string;
  configPath: string;
}

export interface AutotuneConfig {
  openrouter: OpenRouterConfig;
  judge: JudgeConfig;
  optimize: OptimizeConfig;
  deploy: DeployConfig;
  behavior: BehaviorTuningConfig;
  traceDir: string;
  dbPath: string;
  intervalMinutes: number;
  behaviors: string[];
  redact: boolean;
  evalMaxTraces: number;
}

const HOME_DIR = process.env.HOME || '/Users/user';
function getAutotuneHome(): string {
  return process.env.AUTOTUNE_HOME || path.join(HOME_DIR, '.config', 'dotclaw');
}

function getDefaultConfigPathInternal(): string {
  return path.join(getAutotuneHome(), 'autotune.json');
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBehaviors(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const parsed = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function baseDefaults(): AutotuneConfig {
  return {
    openrouter: {
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 120000,
      retries: 3,
      minRetryDelayMs: 500,
      maxRetryDelayMs: 4000
    },
    judge: {
      stage1Model: 'anthropic/claude-haiku-4-5',
      stage2Model: 'anthropic/claude-sonnet-4-5',
      temperature: 0,
      maxOutputTokens: 512
    },
    optimize: {
      minImprovement: 0.05,
      maxFailuresSample: 50,
      maxCandidates: 6,
      sampleSize: 20,
      candidateModel: 'anthropic/claude-haiku-4-5',
      rerankModel: 'anthropic/claude-sonnet-4-5',
      predictorModel: 'anthropic/claude-haiku-4-5'
    },
    deploy: {
      outputDir: path.join(getAutotuneHome(), 'prompts'),
      canaryFraction: 0.1,
      canaryMinSamples: 20,
      canaryMinImprovement: 0.02
    },
    behavior: {
      enabled: false,
      windowDays: 7,
      minTraces: 0,
      maxTraces: 0,
      evalModel: undefined,
      evalSamples: 6,
      promptPacks: false,
      canaryPercent: 20,
      reportDir: path.join(getAutotuneHome(), 'reports'),
      configPath: path.join(getAutotuneHome(), 'behavior.json')
    },
    traceDir: path.join(getAutotuneHome(), 'traces'),
    dbPath: path.join(getAutotuneHome(), 'autotune.db'),
    intervalMinutes: 60,
    behaviors: ['task-extraction', 'response-quality', 'tool-calling', 'memory-policy'],
    redact: true,
    evalMaxTraces: 200
  };
}

function mergeConfig(base: AutotuneConfig, raw: Partial<AutotuneConfig>): AutotuneConfig {
  return {
    openrouter: { ...base.openrouter, ...(raw.openrouter || {}) },
    judge: { ...base.judge, ...(raw.judge || {}) },
    optimize: { ...base.optimize, ...(raw.optimize || {}) },
    deploy: { ...base.deploy, ...(raw.deploy || {}) },
    behavior: { ...base.behavior, ...(raw.behavior || {}) },
    traceDir: raw.traceDir || base.traceDir,
    dbPath: raw.dbPath || base.dbPath,
    intervalMinutes: raw.intervalMinutes || base.intervalMinutes,
    behaviors: raw.behaviors && raw.behaviors.length > 0 ? raw.behaviors : base.behaviors,
    redact: typeof raw.redact === 'boolean' ? raw.redact : base.redact,
    evalMaxTraces: raw.evalMaxTraces || base.evalMaxTraces
  };
}

function applyEnv(config: AutotuneConfig): AutotuneConfig {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AUTOTUNE_OPENROUTER_API_KEY;
  const behaviorEvalModel = process.env.AUTOTUNE_BEHAVIOR_EVAL_MODEL;

  return {
    ...config,
    openrouter: {
      ...config.openrouter,
      apiKey: apiKey ?? config.openrouter.apiKey,
      baseUrl: process.env.OPENROUTER_BASE_URL || config.openrouter.baseUrl,
      timeoutMs: parseNumber(process.env.AUTOTUNE_OPENROUTER_TIMEOUT_MS, config.openrouter.timeoutMs),
      retries: Math.round(parseNumber(process.env.AUTOTUNE_OPENROUTER_RETRIES, config.openrouter.retries)),
      minRetryDelayMs: Math.round(parseNumber(process.env.AUTOTUNE_OPENROUTER_MIN_RETRY_DELAY_MS, config.openrouter.minRetryDelayMs)),
      maxRetryDelayMs: Math.round(parseNumber(process.env.AUTOTUNE_OPENROUTER_MAX_RETRY_DELAY_MS, config.openrouter.maxRetryDelayMs))
    },
    judge: {
      ...config.judge,
      stage1Model: process.env.AUTOTUNE_JUDGE_STAGE1_MODEL || config.judge.stage1Model,
      stage2Model: process.env.AUTOTUNE_JUDGE_STAGE2_MODEL || config.judge.stage2Model,
      temperature: parseNumber(process.env.AUTOTUNE_JUDGE_TEMPERATURE, config.judge.temperature),
      maxOutputTokens: Math.round(parseNumber(process.env.AUTOTUNE_JUDGE_MAX_OUTPUT_TOKENS, config.judge.maxOutputTokens))
    },
    optimize: {
      ...config.optimize,
      minImprovement: parseNumber(process.env.AUTOTUNE_MIN_IMPROVEMENT, config.optimize.minImprovement),
      maxFailuresSample: Math.round(parseNumber(process.env.AUTOTUNE_MAX_FAILURES_SAMPLE, config.optimize.maxFailuresSample)),
      maxCandidates: Math.round(parseNumber(process.env.AUTOTUNE_MAX_CANDIDATES, config.optimize.maxCandidates)),
      sampleSize: Math.round(parseNumber(process.env.AUTOTUNE_SAMPLE_SIZE, config.optimize.sampleSize)),
      candidateModel: process.env.AUTOTUNE_CANDIDATE_MODEL || config.optimize.candidateModel,
      rerankModel: process.env.AUTOTUNE_RERANK_MODEL || config.optimize.rerankModel,
      predictorModel: process.env.AUTOTUNE_PREDICTOR_MODEL || config.optimize.predictorModel
    },
    deploy: {
      ...config.deploy,
      outputDir: process.env.AUTOTUNE_OUTPUT_DIR || config.deploy.outputDir,
      canaryFraction: parseNumber(process.env.AUTOTUNE_CANARY_FRACTION, config.deploy.canaryFraction),
      canaryMinSamples: Math.round(parseNumber(process.env.AUTOTUNE_CANARY_MIN_SAMPLES, config.deploy.canaryMinSamples)),
      canaryMinImprovement: parseNumber(process.env.AUTOTUNE_CANARY_MIN_IMPROVEMENT, config.deploy.canaryMinImprovement)
    },
    behavior: {
      ...config.behavior,
      enabled: parseBoolean(process.env.AUTOTUNE_BEHAVIOR_ENABLED, config.behavior.enabled),
      windowDays: Math.round(parseNumber(process.env.AUTOTUNE_BEHAVIOR_DAYS, config.behavior.windowDays)),
      minTraces: Math.round(parseNumber(process.env.AUTOTUNE_BEHAVIOR_MIN_TRACES, config.behavior.minTraces)),
      maxTraces: Math.round(parseNumber(process.env.AUTOTUNE_BEHAVIOR_MAX_TRACES, config.behavior.maxTraces)),
      evalModel: behaviorEvalModel ? behaviorEvalModel : config.behavior.evalModel,
      evalSamples: Math.round(parseNumber(process.env.AUTOTUNE_BEHAVIOR_EVAL_SAMPLES, config.behavior.evalSamples)),
      promptPacks: parseBoolean(process.env.AUTOTUNE_BEHAVIOR_PROMPT_PACKS, config.behavior.promptPacks),
      canaryPercent: Math.round(parseNumber(process.env.AUTOTUNE_BEHAVIOR_CANARY_PERCENT, config.behavior.canaryPercent)),
      reportDir: process.env.AUTOTUNE_BEHAVIOR_REPORT_DIR || config.behavior.reportDir,
      configPath: process.env.AUTOTUNE_BEHAVIOR_CONFIG_PATH || config.behavior.configPath
    },
    traceDir: process.env.AUTOTUNE_TRACE_DIR || config.traceDir,
    dbPath: process.env.AUTOTUNE_DB_PATH || config.dbPath,
    intervalMinutes: Math.round(parseNumber(process.env.AUTOTUNE_INTERVAL_MINUTES, config.intervalMinutes)),
    behaviors: parseBehaviors(process.env.AUTOTUNE_BEHAVIORS, config.behaviors),
    redact: parseBoolean(process.env.AUTOTUNE_REDACT, config.redact),
    evalMaxTraces: Math.round(parseNumber(process.env.AUTOTUNE_EVAL_MAX_TRACES, config.evalMaxTraces))
  };
}

export function getDefaultConfigPath(): string {
  return getDefaultConfigPathInternal();
}

export function resolveConfigPath(explicitPath?: string): string | null {
  if (explicitPath) return explicitPath;
  if (process.env.AUTOTUNE_CONFIG_PATH) return process.env.AUTOTUNE_CONFIG_PATH;
  const candidate = getDefaultConfigPathInternal();
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

export function loadConfig(configPath?: string): AutotuneConfig {
  const base = baseDefaults();
  const resolved = resolveConfigPath(configPath);

  if (!resolved || !fs.existsSync(resolved)) {
    return applyEnv(base);
  }

  try {
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as Partial<AutotuneConfig>;
    const merged = mergeConfig(base, raw);
    return applyEnv(merged);
  } catch {
    return applyEnv(base);
  }
}

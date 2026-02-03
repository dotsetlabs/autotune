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

export interface AutotuneConfig {
  openrouter: OpenRouterConfig;
  judge: JudgeConfig;
  optimize: OptimizeConfig;
  deploy: DeployConfig;
  traceDir: string;
  dbPath: string;
  intervalMinutes: number;
  behaviors: string[];
  redact: boolean;
  evalMaxTraces: number;
}

const HOME_DIR = process.env.HOME || '/Users/user';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function parseBehaviors(value: string | undefined): string[] {
  if (!value) return ['task-extraction', 'response-quality'];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

const DEFAULT_CONFIG: AutotuneConfig = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || process.env.AUTOTUNE_OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    timeoutMs: parseInt(process.env.AUTOTUNE_OPENROUTER_TIMEOUT_MS || '120000', 10),
    retries: parseInt(process.env.AUTOTUNE_OPENROUTER_RETRIES || '3', 10),
    minRetryDelayMs: parseInt(process.env.AUTOTUNE_OPENROUTER_MIN_RETRY_DELAY_MS || '500', 10),
    maxRetryDelayMs: parseInt(process.env.AUTOTUNE_OPENROUTER_MAX_RETRY_DELAY_MS || '4000', 10)
  },
  judge: {
    stage1Model: process.env.AUTOTUNE_JUDGE_STAGE1_MODEL || 'anthropic/claude-haiku-4-5',
    stage2Model: process.env.AUTOTUNE_JUDGE_STAGE2_MODEL || 'anthropic/claude-sonnet-4-5',
    temperature: parseFloat(process.env.AUTOTUNE_JUDGE_TEMPERATURE || '0'),
    maxOutputTokens: parseInt(process.env.AUTOTUNE_JUDGE_MAX_OUTPUT_TOKENS || '512', 10)
  },
  optimize: {
    minImprovement: parseFloat(process.env.AUTOTUNE_MIN_IMPROVEMENT || '0.05'),
    maxFailuresSample: parseInt(process.env.AUTOTUNE_MAX_FAILURES_SAMPLE || '50', 10),
    maxCandidates: parseInt(process.env.AUTOTUNE_MAX_CANDIDATES || '6', 10),
    sampleSize: parseInt(process.env.AUTOTUNE_SAMPLE_SIZE || '20', 10),
    candidateModel: process.env.AUTOTUNE_CANDIDATE_MODEL || 'anthropic/claude-haiku-4-5',
    rerankModel: process.env.AUTOTUNE_RERANK_MODEL || 'anthropic/claude-sonnet-4-5',
    predictorModel: process.env.AUTOTUNE_PREDICTOR_MODEL || 'anthropic/claude-haiku-4-5'
  },
  deploy: {
    outputDir: process.env.AUTOTUNE_OUTPUT_DIR || path.join(HOME_DIR, '.config', 'dotclaw', 'prompts'),
    canaryFraction: parseFloat(process.env.AUTOTUNE_CANARY_FRACTION || '0.1'),
    canaryMinSamples: parseInt(process.env.AUTOTUNE_CANARY_MIN_SAMPLES || '20', 10),
    canaryMinImprovement: parseFloat(process.env.AUTOTUNE_CANARY_MIN_IMPROVEMENT || '0.02')
  },
  traceDir: process.env.AUTOTUNE_TRACE_DIR || path.join(HOME_DIR, '.config', 'dotclaw', 'traces'),
  dbPath: process.env.AUTOTUNE_DB_PATH || path.join(HOME_DIR, '.config', 'dotclaw', 'autotune.db'),
  intervalMinutes: parseInt(process.env.AUTOTUNE_INTERVAL_MINUTES || '60', 10),
  behaviors: parseBehaviors(process.env.AUTOTUNE_BEHAVIORS),
  redact: parseBoolean(process.env.AUTOTUNE_REDACT, true),
  evalMaxTraces: parseInt(process.env.AUTOTUNE_EVAL_MAX_TRACES || '200', 10)
};

export function loadConfig(configPath?: string): AutotuneConfig {
  if (!configPath) return DEFAULT_CONFIG;
  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<AutotuneConfig>;
    return {
      openrouter: { ...DEFAULT_CONFIG.openrouter, ...(raw.openrouter || {}) },
      judge: { ...DEFAULT_CONFIG.judge, ...(raw.judge || {}) },
      optimize: { ...DEFAULT_CONFIG.optimize, ...(raw.optimize || {}) },
      deploy: { ...DEFAULT_CONFIG.deploy, ...(raw.deploy || {}) },
      traceDir: raw.traceDir || DEFAULT_CONFIG.traceDir,
      dbPath: raw.dbPath || DEFAULT_CONFIG.dbPath,
      intervalMinutes: raw.intervalMinutes || DEFAULT_CONFIG.intervalMinutes,
      behaviors: raw.behaviors && raw.behaviors.length > 0 ? raw.behaviors : DEFAULT_CONFIG.behaviors,
      redact: typeof raw.redact === 'boolean' ? raw.redact : DEFAULT_CONFIG.redact,
      evalMaxTraces: raw.evalMaxTraces || DEFAULT_CONFIG.evalMaxTraces
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

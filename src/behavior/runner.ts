import fs from 'fs';
import path from 'path';
import { AutotuneConfig } from '../config.js';
import { AutotuneDb } from '../storage/sqlite.js';
import { callOpenRouter } from '../openrouter.js';
import { TraceEvent } from '../types.js';
import { BehaviorConfig, adjustBehaviorConfig, loadBehaviorConfig, saveBehaviorConfig } from './config.js';

type Metrics = {
  total: number;
  errorRate: number;
  avgLatencyMs: number;
  avgResponseChars: number;
  toolCalls: number;
  toolFailureRate: number;
  avgMemoryFacts: number;
  evalScore?: number;
};

export type BehaviorTuningResult = {
  reportPath: string | null;
  metrics: Metrics;
  updates: Partial<BehaviorConfig>;
  behavior: BehaviorConfig;
};

function computeMetrics(traces: TraceEvent[]): Metrics {
  if (traces.length == 0) {
    return {
      total: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      avgResponseChars: 0,
      toolCalls: 0,
      toolFailureRate: 0,
      avgMemoryFacts: 0
    };
  }

  let errorCount = 0;
  let totalLatency = 0;
  let totalResponseChars = 0;
  let toolCalls = 0;
  let toolFailures = 0;
  let totalFacts = 0;

  for (const trace of traces) {
    if (trace.error_code) errorCount += 1;
    if (typeof trace.latency_ms == 'number') totalLatency += trace.latency_ms;
    if (trace.output_text) totalResponseChars += trace.output_text.length;
    if (trace.tool_calls && trace.tool_calls.length > 0) {
      toolCalls += trace.tool_calls.length;
      toolFailures += trace.tool_calls.filter(call => !call.ok).length;
    }
    if (trace.memory_facts) totalFacts += trace.memory_facts.length;
  }

  const total = traces.length;
  return {
    total,
    errorRate: errorCount / total,
    avgLatencyMs: totalLatency / total,
    avgResponseChars: totalResponseChars / total,
    toolCalls,
    toolFailureRate: toolCalls > 0 ? toolFailures / toolCalls : 0,
    avgMemoryFacts: totalFacts / total
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.min(100, Math.max(0, value));
}

function deriveBehaviorUpdates(metrics: Metrics): Partial<BehaviorConfig> {
  const updates: Partial<BehaviorConfig> = {};

  if (metrics.toolFailureRate > 0.2) {
    updates.tool_calling_bias = clamp(0.35);
  } else if (metrics.toolFailureRate < 0.05 && metrics.toolCalls > metrics.total * 0.4) {
    updates.tool_calling_bias = clamp(0.65);
  }

  if (metrics.avgResponseChars > 2000) {
    updates.response_style = 'concise';
  } else if (metrics.avgResponseChars < 400) {
    updates.response_style = 'detailed';
  } else {
    updates.response_style = 'balanced';
  }

  if (metrics.avgMemoryFacts < 0.6) {
    updates.memory_importance_threshold = clamp(0.45);
  } else if (metrics.avgMemoryFacts > 2.5) {
    updates.memory_importance_threshold = clamp(0.7);
  }

  if (metrics.errorRate > 0.12) {
    updates.caution_bias = clamp(0.7);
  } else if (metrics.errorRate < 0.03) {
    updates.caution_bias = clamp(0.45);
  }

  if (metrics.evalScore != null) {
    if (metrics.evalScore < 6) {
      updates.response_style = 'detailed';
      updates.caution_bias = clamp(0.75);
    } else if (metrics.evalScore > 8.5) {
      updates.response_style = 'concise';
    }
  }

  return updates;
}

function writePromptPack(params: {
  behavior: string;
  instructions: string;
  version: string;
  filename: string;
  outputDir: string;
  canaryPercent: number;
}) {
  if (!params.outputDir) return;
  fs.mkdirSync(params.outputDir, { recursive: true });
  const payload = {
    name: `autotune-${params.behavior}`,
    version: params.version,
    behavior: params.behavior,
    instructions: params.instructions.trim(),
    demos: [],
    metadata: {
      source: 'autotune',
      canaryPercent: params.canaryPercent
    }
  };
  const filePath = path.join(params.outputDir, params.filename);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function updatePromptPacks(metrics: Metrics, behaviorStyle: BehaviorConfig['response_style'], version: string, config: AutotuneConfig) {
  if (metrics.total == 0) return;

  const toolCallingInstructions = metrics.toolFailureRate > 0.2
    ? 'Be conservative with tool usage. Double-check inputs, and ask clarifying questions before running tools.'
    : 'Use tools when they materially improve accuracy or save time. Summarize tool outcomes clearly.';

  const responseQualityInstructions = behaviorStyle == 'concise'
    ? 'Keep responses short and actionable. Prefer bullets and avoid unnecessary explanation.'
    : behaviorStyle == 'detailed'
      ? 'Provide thorough explanations with step-by-step guidance when appropriate.'
      : 'Balance clarity with brevity. Provide the minimal detail required for the user to act.';

  const canaryPercent = clampPercent(config.behavior.canaryPercent);

  writePromptPack({
    behavior: 'tool-calling',
    instructions: toolCallingInstructions,
    version,
    filename: 'tool-calling.canary.json',
    outputDir: config.deploy.outputDir,
    canaryPercent
  });

  writePromptPack({
    behavior: 'response-quality',
    instructions: responseQualityInstructions,
    version,
    filename: 'response-quality.canary.json',
    outputDir: config.deploy.outputDir,
    canaryPercent
  });
}

function writeReport(metrics: Metrics, updates: Record<string, unknown>, behavior: BehaviorConfig, reportDir: string): string | null {
  if (!reportDir) return null;
  fs.mkdirSync(reportDir, { recursive: true });
  const report = {
    generated_at: new Date().toISOString(),
    metrics,
    behavior_updates: updates,
    behavior
  };
  const reportPath = path.join(reportDir, `autotune-report-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

async function evaluateSample(traces: TraceEvent[], config: AutotuneConfig): Promise<number | null> {
  const evalModel = config.behavior.evalModel;
  if (!evalModel) return null;
  if (!config.openrouter.apiKey) return null;

  const sampleSize = Math.min(Math.max(config.behavior.evalSamples, 0), traces.length);
  const samples = traces.slice(0, sampleSize);
  if (samples.length === 0) return null;

  let totalScore = 0;
  let scored = 0;

  for (const trace of samples) {
    const prompt = [
      'You are evaluating a personal assistant response.',
      'Score from 1 to 10 on usefulness, correctness, and clarity.',
      'Return JSON only: {"score": number, "notes": string}',
      '',
      `Assistant response:
${trace.output_text || ''}`
    ].join('\n');

    try {
      const content = await callOpenRouter(config.openrouter, {
        model: evalModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        maxOutputTokens: 120
      });
      if (!content) continue;
      const parsed = JSON.parse(content) as { score?: number };
      const score = Number(parsed.score);
      if (Number.isFinite(score)) {
        totalScore += score;
        scored += 1;
      }
    } catch {
      continue;
    }
  }

  if (scored === 0) return null;
  return totalScore / scored;
}

export async function runBehaviorTuning(params: {
  db: AutotuneDb;
  config: AutotuneConfig;
  force?: boolean;
}): Promise<BehaviorTuningResult | null> {
  const { db, config, force } = params;
  if (!force && !config.behavior.enabled) return null;

  const windowDays = Number.isFinite(config.behavior.windowDays) ? config.behavior.windowDays : 7;
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const limit = config.behavior.maxTraces > 0 ? config.behavior.maxTraces : undefined;

  const traces = db.getRecentTraces({ since, limit });
  const metrics = computeMetrics(traces);
  const currentBehavior = loadBehaviorConfig(config.behavior.configPath);

  if (config.behavior.minTraces > 0 && metrics.total < config.behavior.minTraces) {
    const reportPath = writeReport(metrics, {}, currentBehavior, config.behavior.reportDir);
    return { reportPath, metrics, updates: {}, behavior: currentBehavior };
  }

  const evalScore = await evaluateSample(traces, config);
  if (evalScore != null) {
    metrics.evalScore = evalScore;
  }

  const updates = deriveBehaviorUpdates(metrics);
  const nextBehavior = adjustBehaviorConfig(currentBehavior, updates);
  saveBehaviorConfig(config.behavior.configPath, nextBehavior);

  const version = `auto-${new Date().toISOString().replace(/[:.]/g, '')}`;
  if (config.behavior.promptPacks) {
    updatePromptPacks(metrics, nextBehavior.response_style, version, config);
  }

  const reportPath = writeReport(metrics, updates, nextBehavior, config.behavior.reportDir);
  return { reportPath, metrics, updates, behavior: nextBehavior };
}

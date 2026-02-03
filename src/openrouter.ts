import { OpenRouterConfig } from './config.js';

export type OpenRouterMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  const variance = Math.round(ms * 0.2);
  return ms + Math.floor(Math.random() * variance) - Math.floor(variance / 2);
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  if (process.env.OPENROUTER_SITE_URL) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
  }
  if (process.env.OPENROUTER_SITE_NAME) {
    headers['X-Title'] = process.env.OPENROUTER_SITE_NAME;
  }
  return headers;
}

export async function callOpenRouter(
  config: OpenRouterConfig,
  params: { model: string; messages: OpenRouterMessage[]; temperature: number; maxOutputTokens: number }
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing');
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxOutputTokens
  };

  let attempt = 0;
  let delayMs = config.minRetryDelayMs;
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const text = await response.text();
      if (!response.ok) {
        if (attempt <= config.retries && [429, 500, 502, 503, 504].includes(response.status)) {
          await sleep(jitter(delayMs));
          delayMs = Math.min(delayMs * 2, config.maxRetryDelayMs);
          continue;
        }
        throw new Error(`OpenRouter HTTP ${response.status}: ${text.slice(0, 300)}`);
      }

      const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
      return data?.choices?.[0]?.message?.content || '';
    } catch (err) {
      clearTimeout(timeout);
      if (attempt <= config.retries) {
        await sleep(jitter(delayMs));
        delayMs = Math.min(delayMs * 2, config.maxRetryDelayMs);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

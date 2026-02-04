const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/g;
const TOKEN_REGEX = /\b(sk-|rk-|sk-or-|sk-ant-|sk-proj-)[A-Za-z0-9_-]{8,}\b/gi;
const GITHUB_TOKEN_REGEX = /\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{8,}\b/gi;
const SLACK_TOKEN_REGEX = /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/gi;
const GOOGLE_API_REGEX = /\bAIza[0-9A-Za-z-_]{20,}\b/g;
const TELEGRAM_BOT_REGEX = /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g;
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g;
const BEARER_REGEX = /\bBearer\s+[A-Za-z0-9._\-+/=]{10,}\b/gi;
const SECRET_ASSIGN_REGEX = /\b(api_key|apikey|token|secret|password|passwd)\b\s*[:=]\s*([A-Za-z0-9._\-+/=]{6,})/gi;

export function redactText(value: string): string {
  if (!value) return value;
  return value
    .replace(EMAIL_REGEX, '<redacted_email>')
    .replace(PHONE_REGEX, '<redacted_phone>')
    .replace(PRIVATE_KEY_REGEX, '<redacted_private_key>')
    .replace(JWT_REGEX, '<redacted_jwt>')
    .replace(TOKEN_REGEX, '<redacted_token>')
    .replace(GITHUB_TOKEN_REGEX, '<redacted_token>')
    .replace(SLACK_TOKEN_REGEX, '<redacted_token>')
    .replace(GOOGLE_API_REGEX, '<redacted_token>')
    .replace(TELEGRAM_BOT_REGEX, '<redacted_token>')
    .replace(BEARER_REGEX, 'Bearer <redacted_token>')
    .replace(SECRET_ASSIGN_REGEX, (_match, key: string) => `${key}=<redacted_secret>`);
}

export function redactObject(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(item => redactObject(item));
  if (typeof value === 'object') {
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      record[key] = redactObject(item);
    }
    return record;
  }
  return value;
}

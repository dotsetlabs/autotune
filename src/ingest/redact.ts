const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/g;
const TOKEN_REGEX = /\b(sk-|rk-)[A-Za-z0-9_-]{8,}\b/g;

export function redactText(value: string): string {
  if (!value) return value;
  return value
    .replace(EMAIL_REGEX, '<redacted_email>')
    .replace(PHONE_REGEX, '<redacted_phone>')
    .replace(TOKEN_REGEX, '<redacted_token>');
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

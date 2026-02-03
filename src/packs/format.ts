import { PromptPack } from '../types.js';

export function serializePromptPack(pack: PromptPack): string {
  return JSON.stringify(pack, null, 2);
}

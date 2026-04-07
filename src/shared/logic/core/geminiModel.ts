import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from '@shared/constants';

export function normalizeGeminiModel(candidate: string): string {
  return GEMINI_MODELS.includes(candidate as (typeof GEMINI_MODELS)[number])
    ? candidate
    : DEFAULT_GEMINI_MODEL;
}

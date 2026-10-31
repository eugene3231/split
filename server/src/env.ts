import { z } from 'zod';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from '@features/receipt-scanner/constants';

const flag = z.enum(['0', '1']).transform((value) => value === '1');
const count = z.coerce.number().int().positive();

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()));

const anchoredPattern = z.string().transform((source, ctx) => {
  try {
    return new RegExp(`^(?:${source})$`);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'not a valid regular expression' });
    return z.NEVER;
  }
});

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  SCAN_MODEL: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
  GEMINI_BASE_URL: z.url().default('https://generativelanguage.googleapis.com'),
  TURNSTILE_SECRET: z.string().min(1),
  ALLOWED_ORIGINS: originList.default([]),
  ALLOWED_ORIGIN_PATTERN: anchoredPattern.optional(),
  TRUST_CF_CONNECTING_IP: flag.default(false),
  DATA_DIR: z.string().min(1).default('/data'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  SCAN_LIMIT_PER_DEVICE: count.default(20),
  SCAN_LIMIT_GLOBAL: count.default(200),
  DEVICE_MINT_LIMIT_PER_IP: count.default(10),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = envSchema.safeParse(present);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment. ${problems.join('; ')}`);
}

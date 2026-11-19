import { z } from 'zod';

export const HEALTH_PATH = '/api/v1/health';

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  migrations: z.number().int().nonnegative(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

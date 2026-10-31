import { z } from 'zod';

export const DEVICES_PATH = '/api/v1/devices';

export const deviceMintRequestSchema = z.object({
  turnstileToken: z.string().min(1),
});

export const deviceMintResponseSchema = z.object({
  token: z.string().min(1),
});
export type DeviceMintResponse = z.infer<typeof deviceMintResponseSchema>;

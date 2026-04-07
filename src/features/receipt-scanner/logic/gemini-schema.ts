import { z } from 'zod';

const geminiChargeSchema = z.object({
  enabled: z.boolean().nullable().describe('Whether this charge is present on the receipt.'),
  amount: z
    .number()
    .nullable()
    .describe('Absolute monetary amount of the charge, or null if not shown.'),
  percent: z
    .number()
    .nullable()
    .describe('Percentage rate of the charge (e.g. 9 for 9%), or null if not shown.'),
  confidence: z
    .number()
    .nullable()
    .describe('Confidence score between 0 and 1 for this detection.'),
  source: z
    .string()
    .nullable()
    .describe('Label or text on the receipt that triggered this detection, or null.'),
});

export const geminiReceiptSchema = z.object({
  items: z
    .array(
      z.object({
        description: z.string().nullable().describe('Item name or description from the receipt.'),
        amount: z.number().nullable().describe('Price of the item as a number.'),
      }),
    )
    .describe('Line items on the receipt.'),
  subtotal: z
    .number()
    .nullable()
    .describe('Subtotal before taxes and charges, or null if not shown.'),
  total: z.number().nullable().describe('Grand total on the receipt, or null if not shown.'),
  detected: z
    .object({
      gst: geminiChargeSchema.describe('GST or VAT charge detected on the receipt.'),
      serviceCharge: geminiChargeSchema.describe('Service charge detected on the receipt.'),
    })
    .describe('Auto-detected charges.'),
  warnings: z.array(z.string()).describe('Any caveats or uncertainties about the extraction.'),
});

export type GeminiChargePayload = z.infer<typeof geminiChargeSchema>;
export type GeminiReceiptPayload = z.infer<typeof geminiReceiptSchema>;

const UNSUPPORTED_KEYS = new Set(['$schema', 'additionalProperties']);

function stripUnsupportedSchemaFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsupportedSchemaFields);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !UNSUPPORTED_KEYS.has(k))
        .map(([k, v]) => [k, stripUnsupportedSchemaFields(v)]),
    );
  }
  return value;
}

export const GEMINI_RECEIPT_RESPONSE_SCHEMA = stripUnsupportedSchemaFields(
  z.toJSONSchema(geminiReceiptSchema),
);

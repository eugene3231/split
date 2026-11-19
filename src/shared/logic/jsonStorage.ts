import { z } from 'zod';

/**
 * One JSON value kept in browser storage, read through its schema. Storage can be blocked or
 * full, so both directions swallow the failure and the app keeps working from memory.
 */
export function jsonStorage<T>(
  kind: 'localStorage' | 'sessionStorage',
  key: string,
  schema: z.ZodType<T>,
) {
  return {
    /** Null when nothing is stored, or when what is stored does not fit the schema. */
    load(): T | null {
      try {
        const raw = window[kind].getItem(key);
        return raw === null ? null : parseJson(raw, schema);
      } catch {
        return null;
      }
    },
    save(value: T): void {
      try {
        window[kind].setItem(key, JSON.stringify(value));
      } catch {
        // Storage is full or blocked.
      }
    },
  };
}

/** Null when the text is not JSON or the schema rejects it. */
export function parseJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** An array that drops the entries its schema rejects, and reads a non-array as empty. */
export function lenientArray<T>(schema: z.ZodType<T>) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((values) =>
      values.flatMap((value) => {
        const result = schema.safeParse(value);
        return result.success ? [result.data] : [];
      }),
    );
}

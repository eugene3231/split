export const PROTOTYPE_NAMES = ['plate', 'claim', 'ledger'] as const;

export type PrototypeName = (typeof PROTOTYPE_NAMES)[number];

export function toPrototypeName(value: string | null): PrototypeName | null {
  return PROTOTYPE_NAMES.find((name) => name === value) ?? null;
}

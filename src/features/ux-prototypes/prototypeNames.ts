export const PROTOTYPE_NAMES = ['plate', 'claim', 'ledger'] as const;

export type PrototypeName = (typeof PROTOTYPE_NAMES)[number];

export type PrototypeReceiptName = 'dinner' | 'stress';

export interface PrototypeSelection {
  name: PrototypeName;
  receipt: PrototypeReceiptName;
}

export function readPrototypeSelection(search: string): PrototypeSelection | null {
  const params = new URLSearchParams(search);
  const name = PROTOTYPE_NAMES.find((candidate) => candidate === params.get('prototype'));
  if (!name) return null;
  return { name, receipt: params.get('receipt') === 'stress' ? 'stress' : 'dinner' };
}

export function toPrototypeSearch({ name, receipt }: PrototypeSelection): string {
  return receipt === 'stress' ? `?prototype=${name}&receipt=stress` : `?prototype=${name}`;
}

import type { Person, Receipt } from '@shared/types';

export const WIZARD_STEPS = ['people', 'receipt', 'items', 'final'] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface SessionDraft {
  version: 2;
  people: Person[];
  receipts: Receipt[];
  activeReceiptId: string;
  payerMobile: string;
  savedAt: string;
}

export interface PersistedOcrSettings {
  version: 1;
  geminiModel: string;
  savedAt: string;
}

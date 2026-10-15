import type { Person, Receipt } from '@shared/types';
import type { NonEmptyArray } from '@features/split-workspace/logic/nonEmpty';

export const WIZARD_STEPS = ['people', 'receipt', 'items', 'final'] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const ASSIGN_MODES = ['person', 'item'] as const;

export type AssignMode = (typeof ASSIGN_MODES)[number];

/** The split itself. The store holds it, and a draft is this plus a version and a timestamp. */
export interface WorkspaceState {
  people: Person[];
  /** There is always at least one receipt. */
  receipts: NonEmptyArray<Receipt>;
  activeReceiptId: string;
  payerMobile: string;
}

export interface SessionDraft extends WorkspaceState {
  version: 3;
  savedAt: string;
}

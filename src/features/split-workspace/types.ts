export const WIZARD_STEPS = ['people', 'receipt', 'items', 'final'] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

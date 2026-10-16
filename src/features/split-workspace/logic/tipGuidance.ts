import type { ChargeState } from '@shared/types';
import { parseNumber } from '@shared/logic/core/money';

export const TIP_PERCENTS = ['15', '18', '20', '22'] as const;

export type TipPercent = (typeof TIP_PERCENTS)[number];

/** The party size from which US restaurants commonly add a gratuity to the bill themselves. */
export const LARGE_PARTY_SIZE = 6;

export interface TipGuidance {
  /** The preset a tip starts at when it is switched on. */
  suggestedPercent: TipPercent;
  hint: string;
}

interface TipGuidanceInput {
  partySize: number;
  serviceCharge: ChargeState;
}

export function resolveTipGuidance({ partySize, serviceCharge }: TipGuidanceInput): TipGuidance {
  if (hasServiceCharge(serviceCharge)) {
    return {
      suggestedPercent: '18',
      hint: 'This receipt already has a service charge, which usually takes the place of a tip.',
    };
  }
  if (partySize >= LARGE_PARTY_SIZE) {
    return {
      suggestedPercent: '20',
      hint: `For ${LARGE_PARTY_SIZE} or more people, 18–20% is usual and is often added to the bill already. Check the receipt first.`,
    };
  }
  return {
    suggestedPercent: '18',
    hint: 'For table service in the US, 15–20% of the bill before tax is usual.',
  };
}

/** The preset a tip is set to, or null when it is off, a fixed amount or another percent. */
export function selectedTipPercent(tip: ChargeState): TipPercent | null {
  if (!tip.enabled || tip.mode !== 'percent') return null;
  const rate = parseNumber(tip.percentInput);
  return TIP_PERCENTS.find((percent) => Number(percent) === rate) ?? null;
}

function hasServiceCharge(charge: ChargeState): boolean {
  if (!charge.enabled) return false;
  const value = parseNumber(charge.mode === 'percent' ? charge.percentInput : charge.amountInput);
  return value !== null && value > 0;
}

import { cn } from '@shared/utils/cn';
import type { Direction } from '@features/group-ledger/logic/describe';

const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-container',
  secondary:
    'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low',
  ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
  danger: 'text-error hover:bg-error-container/60',
} as const;

const SIZES = {
  md: 'h-11 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-2xl px-5 text-base',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
    VARIANTS[variant],
    SIZES[size],
  );
}

export function actionBarButtonClass(enabled: boolean) {
  return cn(
    'flex shrink-0 items-center justify-center gap-1 rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-95',
    enabled ? 'bg-white text-primary' : 'cursor-not-allowed bg-white/15 text-white/50',
  );
}

export const DIRECTION_TEXT: Record<Direction, string> = {
  owed: 'text-secondary',
  owes: 'text-warning',
  even: 'text-on-surface-variant',
};

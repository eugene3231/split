import type { WeightsInputMode } from '@shared/types';
import { cn } from '@shared/utils/cn';

const MODE_TABS: { key: WeightsInputMode; label: string }[] = [
  { key: 'shares', label: 'Shares' },
  { key: 'percent', label: 'Percent' },
  { key: 'amount', label: 'Amount' },
];

interface ModeTabsProps {
  mode: WeightsInputMode;
  onModeChange: (mode: WeightsInputMode) => void;
  className?: string;
}

export function ModeTabs({ mode, onModeChange, className }: ModeTabsProps) {
  return (
    <div
      role="group"
      aria-label="Split by"
      className={cn('grid grid-cols-3 gap-1 rounded-xl bg-surface-container-low p-1', className)}
    >
      {MODE_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-testid={`assign-mode-tab-${tab.key}`}
          aria-pressed={mode === tab.key}
          onClick={() => onModeChange(tab.key)}
          className={cn(
            'rounded-lg px-2 py-2 text-xs font-bold transition-colors',
            mode === tab.key
              ? 'bg-surface-container-lowest text-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

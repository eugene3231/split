import type { WeightsInputMode } from '@shared/types';
import { cn } from '@shared/utils/cn';

const MODE_TABS: { key: WeightsInputMode; label: string }[] = [
  { key: 'shares', label: 'Shares' },
  { key: 'percent', label: 'Percent' },
  { key: 'amount', label: 'Amount' },
];

type ModeTabsProps = {
  mode: WeightsInputMode;
  onModeChange: (mode: WeightsInputMode) => void;
  disabled?: boolean;
};

export function ModeTabs({ mode, onModeChange, disabled }: ModeTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container-low p-1">
      {MODE_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-testid={`assign-mode-tab-${tab.key}`}
          onClick={() => onModeChange(tab.key)}
          disabled={disabled}
          className={cn(
            'rounded-lg px-2 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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

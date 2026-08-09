import type { WeightsInputMode } from '@shared/types';
import { ModeTabs } from './ModeTabs';

type SplitCardProps = {
  mode: WeightsInputMode;
  onModeChange: (mode: WeightsInputMode) => void;
  disabled: boolean;
};

export function SplitCard({ mode, onModeChange, disabled }: SplitCardProps) {
  return (
    <div
      role="group"
      aria-label="Split"
      data-testid="assign-split-card"
      className="space-y-2 rounded-xl bg-surface-container-low p-3"
    >
      <span className="block text-xs font-bold tracking-widest text-on-surface-variant uppercase">
        Split
      </span>
      <ModeTabs mode={mode} onModeChange={onModeChange} disabled={disabled} />
    </div>
  );
}

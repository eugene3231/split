import { useState } from 'react';
import { ToggleGroup } from 'radix-ui';
import type { ChargeState } from '@shared/types';
import type { CurrencyCode } from '@shared/constants';
import {
  ChargeModeToggle,
  ChargeSwitch,
  ChargeValueInput,
} from '@features/split-workspace/components/shared/ChargeToggle';
import {
  TIP_PERCENTS,
  selectedTipPercent,
  type TipGuidance,
} from '@features/split-workspace/logic/tipGuidance';

const CUSTOM = 'custom';

const PRESET_CLASS =
  'rounded-lg py-2 text-xs font-extrabold text-on-surface-variant transition-all hover:text-primary data-[state=on]:bg-surface-container-lowest data-[state=on]:text-primary data-[state=on]:shadow-sm';

interface Props {
  tip: ChargeState;
  onChange: (next: ChargeState) => void;
  guidance: TipGuidance;
  currency: CurrencyCode;
}

export function TipControl({ tip, onChange, guidance, currency }: Props) {
  const [customChosen, setCustomChosen] = useState(false);
  const preset = selectedTipPercent(tip);
  const showCustom = customChosen || preset === null;

  const switchOn = (enabled: boolean) => {
    if (!enabled) {
      onChange({ ...tip, enabled });
      return;
    }
    const isBlank = tip.mode === 'percent' && tip.percentInput.trim() === '';
    onChange({
      ...tip,
      enabled,
      ...(isBlank && { percentInput: guidance.suggestedPercent }),
    });
  };

  const choose = (choice: string) => {
    if (!choice) return;
    if (choice === CUSTOM) {
      setCustomChosen(true);
      return;
    }
    setCustomChosen(false);
    onChange({ ...tip, enabled: true, mode: 'percent', percentInput: choice });
  };

  return (
    <div className="space-y-3">
      <ChargeSwitch label="Tip" checked={tip.enabled} onCheckedChange={switchOn} />

      {tip.enabled && (
        <>
          <ToggleGroup.Root
            type="single"
            aria-label="Tip amount"
            value={showCustom ? CUSTOM : (preset ?? '')}
            onValueChange={choose}
            className="grid grid-cols-5 gap-1 rounded-xl bg-surface-container-low p-1"
          >
            {TIP_PERCENTS.map((percent) => (
              <ToggleGroup.Item key={percent} value={percent} className={PRESET_CLASS}>
                {percent}%
              </ToggleGroup.Item>
            ))}
            <ToggleGroup.Item value={CUSTOM} className={PRESET_CLASS}>
              Custom
            </ToggleGroup.Item>
          </ToggleGroup.Root>

          {showCustom && (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <ChargeValueInput label="Tip" value={tip} onChange={onChange} currency={currency} />
              </div>
              <ChargeModeToggle label="Tip" value={tip} onChange={onChange} currency={currency} />
            </div>
          )}

          <p className="text-xs text-on-surface-variant" data-testid="tip-hint">
            {guidance.hint}
          </p>
        </>
      )}
    </div>
  );
}

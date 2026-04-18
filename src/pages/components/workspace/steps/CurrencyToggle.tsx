import { getCurrencySymbol } from '@shared/logic/core/money';
import { BASE_CURRENCY } from '@shared/constants';
import { cn } from '@shared/utils/cn';

interface Props {
  showBaseCurrency: boolean;
  onToggle: (show: boolean) => void;
  activeTab: string;
  currentCurrency: string;
}

export function CurrencyToggle({ showBaseCurrency, onToggle, activeTab, currentCurrency }: Props) {
  return (
    <div className="flex items-center gap-1 bg-surface-container rounded-full p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={cn(
          'px-3 py-1 rounded-full transition-all',
          !showBaseCurrency
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface',
        )}
      >
        {activeTab === 'total'
          ? 'Original'
          : `${getCurrencySymbol(currentCurrency)} ${currentCurrency}`}
      </button>
      <button
        type="button"
        onClick={() => onToggle(true)}
        className={cn(
          'px-3 py-1 rounded-full transition-all',
          showBaseCurrency
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface',
        )}
      >
        {getCurrencySymbol(BASE_CURRENCY)} {BASE_CURRENCY}
      </button>
    </div>
  );
}

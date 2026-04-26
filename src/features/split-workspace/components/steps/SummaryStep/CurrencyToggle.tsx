import { BASE_CURRENCY } from '@shared/constants';

interface Props {
  showBaseCurrency: boolean;
  onToggle: (show: boolean) => void;
  activeTab: string;
  currentCurrency: string;
}

export function CurrencyToggle({ showBaseCurrency, onToggle, activeTab, currentCurrency }: Props) {
  const displayCurrency = showBaseCurrency
    ? BASE_CURRENCY
    : activeTab === 'total'
      ? 'Billed'
      : currentCurrency;
  const nextCurrency = showBaseCurrency
    ? activeTab === 'total'
      ? 'billed currencies'
      : currentCurrency
    : BASE_CURRENCY;

  return (
    <button
      type="button"
      onClick={() => onToggle(!showBaseCurrency)}
      aria-label={`Currency ${displayCurrency}. Switch to ${nextCurrency}.`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cream px-3.5 py-2 text-left text-ink transition-colors hover:bg-cream-dim focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:outline-none active:scale-[0.99]"
    >
      <span>
        <span className="block text-[8px] leading-none font-semibold tracking-[0.2em] text-ink2 uppercase">
          Currency
        </span>
        <span className="mt-0.5 block font-display text-lg leading-none font-semibold">
          {displayCurrency}
        </span>
      </span>
      <span className="material-symbols-outlined text-sm leading-none text-ink">expand_more</span>
    </button>
  );
}

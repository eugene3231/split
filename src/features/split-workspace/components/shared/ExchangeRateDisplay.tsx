import { getEffectiveRate } from '@features/split-workspace/logic/exchangeRates';
import { useState } from 'react';
import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { formatExchangeRate } from '@shared/logic/core/money';
import {
  computeReverseRate,
  flipRateDirection,
  parseRateInput,
  resolveReadableRateDirection,
  type RateDirection,
} from '@features/split-workspace/logic/exchangeRateDisplay';

interface Props {
  receiptId: string;
  currency: CurrencyCode;
  exchangeRateOverride: number | null;
}

export function ExchangeRateDisplay({ receiptId, currency, exchangeRateOverride }: Props) {
  const patchReceipt = useReceiptStore((s) => s.patchReceipt);
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);
  const [isFlipped, setIsFlipped] = useState(false);
  const [editingField, setEditingField] = useState<RateDirection | null>(null);
  const [inputValue, setInputValue] = useState('');

  const autoRate = getEffectiveRate(currency, exchangeRates, null);
  const effectiveRate = exchangeRateOverride ?? autoRate;
  const isOverridden = exchangeRateOverride !== null;
  const reverseRate = computeReverseRate(effectiveRate);
  const readableDirection = resolveReadableRateDirection(effectiveRate);
  const direction = isFlipped ? flipRateDirection(readableDirection) : readableDirection;
  const [fromCurrency, toCurrency, shownRate] =
    direction === 'forward'
      ? [currency, BASE_CURRENCY, effectiveRate]
      : [BASE_CURRENCY, currency, reverseRate];

  const startEditing = (field: RateDirection) => {
    setInputValue(
      field === 'forward'
        ? effectiveRate.toFixed(6).replace(/\.?0+$/, '')
        : reverseRate.toFixed(6).replace(/\.?0+$/, ''),
    );
    setEditingField(field);
  };

  const commitEdit = () => {
    const forwardRate = parseRateInput(inputValue, editingField);
    if (forwardRate !== null) {
      patchReceipt(receiptId, { exchangeRateOverride: forwardRate });
    }
    setEditingField(null);
  };

  const resetToAuto = () => {
    patchReceipt(receiptId, { exchangeRateOverride: null });
    setEditingField(null);
  };

  const inputClass =
    'w-20 bg-surface-container border border-primary rounded px-1 text-on-surface text-xs focus:outline-none';
  const buttonClass =
    'font-semibold text-on-surface hover:text-primary transition-colors underline decoration-dashed px-1 py-0.5 rounded border border-transparent hover:border-outline-variant';

  return (
    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
      <span className="material-symbols-outlined text-sm">currency_exchange</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsFlipped((flipped) => !flipped)}
          aria-label={`Show the rate as 1 ${toCurrency} in ${fromCurrency}`}
          className="rounded transition-colors hover:text-on-surface"
        >
          1 {fromCurrency} =
        </button>
        {editingField === direction ? (
          <input
            type="number"
            step="any"
            min="0"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditingField(null);
            }}
            className={inputClass}
            autoFocus
          />
        ) : (
          <button type="button" onClick={() => startEditing(direction)} className={buttonClass}>
            {formatExchangeRate(shownRate)} {toCurrency}
          </button>
        )}
      </span>
      {isOverridden ? (
        <>
          <span className="rounded bg-warning-container px-1.5 py-0.5 text-xs font-semibold text-on-warning-container">
            Manual
          </span>
          <button
            type="button"
            onClick={resetToAuto}
            className="text-xs text-on-surface-variant transition-colors hover:text-primary"
            title="Reset to auto rate"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </>
      ) : (
        <span className="rounded bg-secondary-container/50 px-1.5 py-0.5 text-xs font-semibold text-on-secondary-container">
          Auto
        </span>
      )}
    </div>
  );
}

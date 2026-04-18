import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { BASE_CURRENCY, FALLBACK_RATES_TO_SGD } from '@shared/constants';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { useCurrencyStore } from '@shared/stores/currencyStore';

interface Props {
  receiptId: string;
  currency: string;
  exchangeRateOverride: number | null;
}

export function ExchangeRateDisplay({ receiptId, currency, exchangeRateOverride }: Props) {
  const { setReceiptExchangeRateOverride } = useReceiptStore(
    useShallow((s) => ({
      setReceiptExchangeRateOverride: s.setReceiptExchangeRateOverride,
    })),
  );
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);
  const [editingField, setEditingField] = useState<'forward' | 'reverse' | null>(null);
  const [inputValue, setInputValue] = useState('');

  const autoRate = exchangeRates[currency] ?? FALLBACK_RATES_TO_SGD[currency] ?? 1;
  const effectiveRate = exchangeRateOverride ?? autoRate;
  const isOverridden = exchangeRateOverride !== null;
  const reverseRate = effectiveRate > 0 ? 1 / effectiveRate : 0;

  const startEditing = (field: 'forward' | 'reverse') => {
    setInputValue(
      field === 'forward'
        ? effectiveRate.toFixed(6).replace(/\.?0+$/, '')
        : reverseRate.toFixed(6).replace(/\.?0+$/, ''),
    );
    setEditingField(field);
  };

  const commitEdit = () => {
    const parsed = parseFloat(inputValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      const forwardRate = editingField === 'reverse' ? 1 / parsed : parsed;
      setReceiptExchangeRateOverride(receiptId, forwardRate);
    }
    setEditingField(null);
  };

  const resetToAuto = () => {
    setReceiptExchangeRateOverride(receiptId, null);
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
        <span>1 {currency} =</span>
        {editingField === 'forward' ? (
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
          <button type="button" onClick={() => startEditing('forward')} className={buttonClass}>
            {effectiveRate.toFixed(5).replace(/\.?0+$/, '')} {BASE_CURRENCY}
          </button>
        )}
        <span className="text-outline/60">·</span>
        <span>1 {BASE_CURRENCY} =</span>
        {editingField === 'reverse' ? (
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
          <button type="button" onClick={() => startEditing('reverse')} className={buttonClass}>
            {reverseRate.toFixed(5).replace(/\.?0+$/, '')} {currency}
          </button>
        )}
      </span>
      {isOverridden ? (
        <>
          <span className="bg-warning/20 text-warning-container px-1.5 py-0.5 rounded text-xs font-semibold">
            Manual
          </span>
          <button
            type="button"
            onClick={resetToAuto}
            className="text-xs text-on-surface-variant hover:text-primary transition-colors"
            title="Reset to auto rate"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </>
      ) : (
        <span className="bg-secondary-container/50 text-on-secondary-container px-1.5 py-0.5 rounded text-xs font-semibold">
          Auto
        </span>
      )}
    </div>
  );
}

import { useRef, useState } from 'react';
import type { ChargeState, EditableItem } from '@shared/types';
import type { CurrencyCode } from '@shared/constants';
import {
  formatMoneyAmount,
  formatMoneyInput,
  formatPercentInput,
  getCurrencySymbol,
} from '@shared/logic/core/money';
import { FormattedNumberInput } from '@features/split-workspace/components/shared/FormattedNumberInput';

interface Props {
  item: EditableItem;
  discount: ChargeState;
  currency: CurrencyCode;
  onUpdate: (updater: (current: EditableItem) => EditableItem) => void;
  onRemove: () => void;
}

export function LineItemCard({ item, discount, currency, onUpdate, onRemove }: Props) {
  const formatPrice = (input: string) => formatMoneyInput(input, currency);
  const priceWidth = Math.max(formatPrice(item.amountInput).length, item.amountInput.length);
  const [showDiscount, setShowDiscount] = useState(!!item.discountPercentInput);
  const discountInputRef = useRef<HTMLInputElement>(null);

  const handleShowDiscount = () => {
    setShowDiscount(true);
    requestAnimationFrame(() => discountInputRef.current?.focus());
  };

  const handleHideDiscount = () => {
    onUpdate((current) => ({ ...current, discountPercentInput: '' }));
    setShowDiscount(false);
  };

  const discountVisible = showDiscount || !!item.discountPercentInput;

  return (
    <div className="group relative rounded-xl border border-surface-container-highest bg-surface-container-lowest px-3 py-2.5 shadow-sm transition-all hover:border-primary/20">
      {/* Name + Price row */}
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate((current) => ({ ...current, name: e.target.value }))}
          placeholder="Item name"
          className="w-full border-none bg-transparent p-0 text-base font-medium text-on-surface outline-none placeholder:text-outline focus:ring-0"
        />
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-surface-container px-2 py-1">
            <span className="text-xs font-bold text-on-surface-variant">
              {getCurrencySymbol(currency)}
            </span>
            <FormattedNumberInput
              aria-label="Price"
              value={item.amountInput}
              format={formatPrice}
              onValueChange={(amountInput) => onUpdate((current) => ({ ...current, amountInput }))}
              placeholder={formatMoneyAmount(0, currency)}
              // Grows with the price so rupiah amounts fit; Tailwind has no content-width utility that Safari and Firefox both support.
              style={{ width: `${Math.min(Math.max(priceWidth, 4), 11) + 1}ch` }}
              className="border-none bg-transparent p-0 text-right text-base font-bold text-primary outline-none placeholder:text-outline focus:ring-0"
            />
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove item"
            className="flex items-center justify-center text-error opacity-40 transition-opacity hover:opacity-100"
          >
            <span className="material-symbols-outlined !text-base">close</span>
          </button>
        </div>
      </div>

      {/* Discount row */}
      {discountVisible && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-secondary">loyalty</span>
            <span className="text-xs font-bold text-secondary">Discount</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border border-secondary-container/50 bg-surface-container px-1.5 py-0.5">
              <FormattedNumberInput
                ref={discountInputRef}
                aria-label="Discount percent"
                value={item.discountPercentInput}
                format={formatPercentInput}
                onValueChange={(discountPercentInput) =>
                  onUpdate((current) => ({ ...current, discountPercentInput }))
                }
                placeholder="0"
                className="w-8 border-none bg-transparent p-0 text-right text-xs font-bold text-secondary outline-none focus:ring-0"
              />
              <span className="ml-0.5 text-xs font-bold text-secondary">%</span>
            </div>
            <button
              type="button"
              onClick={handleHideDiscount}
              aria-label="Remove discount"
              className="flex items-center justify-center text-error opacity-40 transition-opacity hover:opacity-100"
            >
              <span className="material-symbols-outlined !text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-1.5 flex items-center justify-between">
        {!discountVisible && (
          <button
            type="button"
            onClick={handleShowDiscount}
            className="flex items-center gap-0.5 text-xs font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined text-xs">add</span>
            <span>Discount</span>
          </button>
        )}
        {discount.enabled && (
          <span className="ml-auto text-xs text-on-surface-variant italic">
            {discount.mode === 'percent'
              ? `${formatPercentInput(discount.percentInput) || '0'}% bill discount`
              : 'Bill discount'}{' '}
            applied
          </span>
        )}
      </div>
    </div>
  );
}

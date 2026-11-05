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

  // On wide screens with a pointer, "+ Discount" waits in the item's own row until the row is
  // hovered or focused, so each item stays one line. Elsewhere it sits on a second line.
  return (
    <li className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-2.5 md:px-5 md:[@media(hover:hover)]:grid-cols-[minmax(0,1fr)_auto_auto]">
      <input
        type="text"
        value={item.name}
        onChange={(e) => onUpdate((current) => ({ ...current, name: e.target.value }))}
        placeholder="Item name"
        className="col-start-1 row-start-1 w-full min-w-0 border-none bg-transparent p-0 text-base font-medium text-on-surface outline-none placeholder:text-outline focus:ring-0"
      />
      <div className="col-start-2 row-start-1 flex items-center gap-1 md:[@media(hover:hover)]:col-start-3">
        <div className="flex h-9 min-w-24 items-center justify-between gap-1 field px-2.5">
          <span className="text-sm text-on-surface-variant">{getCurrencySymbol(currency)}</span>
          <FormattedNumberInput
            aria-label="Price"
            value={item.amountInput}
            format={formatPrice}
            onValueChange={(amountInput) => onUpdate((current) => ({ ...current, amountInput }))}
            placeholder={formatMoneyAmount(0, currency)}
            // Grows with the price so rupiah amounts fit; Tailwind has no content-width utility that Safari and Firefox both support.
            style={{ width: `${Math.min(Math.max(priceWidth, 4), 11) + 1}ch` }}
            className="border-none bg-transparent p-0 text-right text-base font-semibold text-on-surface tabular-nums outline-none placeholder:text-outline focus:ring-0"
          />
        </div>
        <RemoveButton label="Remove item" onClick={onRemove} />
      </div>

      {discountVisible ? (
        <div className="col-span-full row-start-2 mt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-secondary">
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              sell
            </span>
            Discount
          </span>
          <div className="flex items-center gap-1">
            <div className="flex h-8 items-center field px-2">
              <FormattedNumberInput
                ref={discountInputRef}
                aria-label="Discount percent"
                value={item.discountPercentInput}
                format={formatPercentInput}
                onValueChange={(discountPercentInput) =>
                  onUpdate((current) => ({ ...current, discountPercentInput }))
                }
                placeholder="0"
                className="w-8 border-none bg-transparent p-0 text-right text-sm font-semibold text-secondary tabular-nums outline-none focus:ring-0"
              />
              <span className="ml-0.5 text-sm font-semibold text-secondary">%</span>
            </div>
            <RemoveButton label="Remove discount" onClick={handleHideDiscount} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleShowDiscount}
          className="col-start-1 row-start-2 -ml-1 flex items-center gap-0.5 justify-self-start rounded-md px-1 py-0.5 text-xs font-medium text-outline transition-[color,opacity] group-focus-within:opacity-100 group-hover:opacity-100 hover:text-on-surface focus-visible:opacity-100 md:[@media(hover:hover)]:col-start-2 md:[@media(hover:hover)]:row-start-1 md:[@media(hover:hover)]:opacity-0"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-sm!">
            add
          </span>
          Discount
        </button>
      )}

      {discount.enabled && (
        <p className="col-span-full mt-1 text-xs text-on-surface-variant">
          {discount.mode === 'percent'
            ? `${formatPercentInput(discount.percentInput) || '0'}% bill discount`
            : 'Bill discount'}{' '}
          applied
        </p>
      )}
    </li>
  );
}

interface RemoveButtonProps {
  label: string;
  onClick: () => void;
}

function RemoveButton({ label, onClick }: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-error-container/50 hover:text-error focus-visible:text-error focus-visible:ring-2 focus-visible:ring-error/30 focus-visible:outline-none"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-lg!">
        close
      </span>
    </button>
  );
}

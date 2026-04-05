import { useRef, useState } from 'react'
import type { ChargeState, EditableItem } from '@shared/types'
import { CURRENCY_SYMBOLS, BASE_CURRENCY } from '@shared/constants'

interface Props {
  item: EditableItem
  discount: ChargeState
  currency?: string
  onUpdate: (updater: (current: EditableItem) => EditableItem) => void
  onRemove: () => void
}

export function LineItemCard({ item, discount, currency = BASE_CURRENCY, onUpdate, onRemove }: Props) {
  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? currency
  const [showDiscount, setShowDiscount] = useState(!!item.discountPercentInput)
  const discountInputRef = useRef<HTMLInputElement>(null)

  const handleShowDiscount = () => {
    setShowDiscount(true)
    requestAnimationFrame(() => discountInputRef.current?.focus())
  }

  const handleHideDiscount = () => {
    onUpdate((current) => ({ ...current, discountPercentInput: '' }))
    setShowDiscount(false)
  }

  const discountVisible = showDiscount || !!item.discountPercentInput

  return (
    <div className="bg-surface-container-lowest px-3 py-2.5 rounded-xl shadow-sm border border-surface-container-highest hover:border-primary/20 transition-all group relative">
      {/* Name + Price row */}
      <div className="flex justify-between items-center gap-3">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate((current) => ({ ...current, name: e.target.value }))}
          placeholder="Item name"
          className="bg-transparent border-none p-0 focus:ring-0 font-medium text-on-surface w-full text-base outline-none placeholder:text-outline"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-surface-container rounded-lg px-2 py-1">
            <span className="text-xs font-bold text-on-surface-variant">{currencySymbol}</span>
            <input
              type="text"
              inputMode="decimal"
              value={item.amountInput}
              onChange={(e) => onUpdate((current) => ({ ...current, amountInput: e.target.value }))}
              placeholder="0.00"
              className="bg-transparent border-none p-0 focus:ring-0 font-bold text-primary w-16 text-right text-base outline-none placeholder:text-outline"
            />
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove item"
            className="flex items-center justify-center text-error opacity-40 hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined !text-base">close</span>
          </button>
        </div>
      </div>

      {/* Discount row */}
      {discountVisible && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-sm">loyalty</span>
            <span className="text-xs font-bold text-secondary">Discount</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-container rounded border border-secondary-container/50 px-1.5 py-0.5">
              <input
                ref={discountInputRef}
                type="text"
                inputMode="decimal"
                value={item.discountPercentInput}
                onChange={(e) => onUpdate((current) => ({ ...current, discountPercentInput: e.target.value }))}
                placeholder="0"
                className="bg-transparent border-none p-0 focus:ring-0 font-bold text-secondary w-8 text-right text-xs outline-none"
              />
              <span className="text-[10px] font-bold text-secondary ml-0.5">%</span>
            </div>
            <button
              type="button"
              onClick={handleHideDiscount}
              aria-label="Remove discount"
              className="flex items-center justify-center text-error opacity-40 hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined !text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1.5">
        {!discountVisible && (
          <button
            type="button"
            onClick={handleShowDiscount}
            className="flex items-center gap-0.5 text-[10px] font-semibold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-xs">add</span>
            <span>Discount</span>
          </button>
        )}
        {discount.enabled && (
          <span className="text-[10px] text-on-surface-variant italic ml-auto">
            {discount.mode === 'percent' ? `${discount.percentInput || '0'}% bill discount` : 'Bill discount'} applied
          </span>
        )}
      </div>
    </div>
  )
}

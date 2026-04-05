import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { BASE_CURRENCY, FALLBACK_RATES_TO_SGD } from '@shared/constants'
import { useReceiptStore } from '@shared/stores/receiptStore'

interface Props {
  receiptId: string
  currency: string
  exchangeRateOverride: number | null
}

export function ExchangeRateDisplay({ receiptId, currency, exchangeRateOverride }: Props) {
  const { exchangeRates, setReceiptExchangeRateOverride } = useReceiptStore(
    useShallow((s) => ({
      exchangeRates: s.exchangeRates,
      setReceiptExchangeRateOverride: s.setReceiptExchangeRateOverride,
    })),
  )
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const autoRate = exchangeRates[currency] ?? FALLBACK_RATES_TO_SGD[currency] ?? 1
  const effectiveRate = exchangeRateOverride ?? autoRate
  const isOverridden = exchangeRateOverride !== null

  const startEditing = () => {
    setInputValue(effectiveRate.toFixed(6).replace(/\.?0+$/, ''))
    setEditing(true)
  }

  const commitEdit = () => {
    const parsed = parseFloat(inputValue)
    if (Number.isFinite(parsed) && parsed > 0) {
      setReceiptExchangeRateOverride(receiptId, parsed)
    }
    setEditing(false)
  }

  const resetToAuto = () => {
    setReceiptExchangeRateOverride(receiptId, null)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
      <span className="material-symbols-outlined text-sm">currency_exchange</span>
      <span>
        1 {currency} ={' '}
        {editing ? (
          <input
            type="number"
            step="any"
            min="0"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-20 bg-surface-container border border-primary rounded px-1 text-on-surface text-xs focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="font-semibold text-on-surface hover:text-primary transition-colors underline decoration-dashed"
          >
            {effectiveRate.toFixed(4).replace(/\.?0+$/, '')} {BASE_CURRENCY}
          </button>
        )}
      </span>
      {isOverridden ? (
        <>
          <span className="bg-warning/20 text-warning-container px-1.5 py-0.5 rounded text-xs font-semibold">Manual</span>
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
        <span className="bg-secondary-container/50 text-on-secondary-container px-1.5 py-0.5 rounded text-xs font-semibold">Auto</span>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { GlobalChargesSection } from '@features/split-config/components/GlobalChargesSection'
import { ReceiptImportPanel } from '@features/receipt-scanner/components/ReceiptImportPanel'
import { SplitTotalsCard } from '@features/split-results/components/SplitTotalsCard'
import type { ChargeState, EditableItem, SplitResult } from '@shared/types'
import { hasAnyValidReceiptItem } from '@pages/logic/wizardValidation'

type Props = {
  items: EditableItem[]
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  receiptTotalInput: string
  onApplyDiscount: () => void
  onReceiptFileSelected: (file: File | null) => void
  onScanReceipt: () => void
  mockReceipts: Array<{ label: string; onLoad: () => void }>
  onDiscountChange: (discount: ChargeState) => void
  onServiceChargeChange: (serviceCharge: ChargeState) => void
  onGstChange: (gst: ChargeState) => void
  onReceiptTotalInputChange: (value: string) => void
  onAddItem: () => void
  onRemoveItem: (id: string) => void
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void
}

export function ScanReceiptStep({
  items,
  split,
  discount,
  serviceCharge,
  gst,
  reconciliationCents,
  receiptTotalInput,
  onApplyDiscount,
  onReceiptFileSelected,
  onScanReceipt,
  mockReceipts,
  onDiscountChange,
  onServiceChargeChange,
  onGstChange,
  onReceiptTotalInputChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: Props) {
  const [showDiscountIds, setShowDiscountIds] = useState<Set<string>>(new Set())
  const discountInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const isDiscountVisible = (item: { id: string; discountPercentInput: string }) =>
    showDiscountIds.has(item.id) || !!item.discountPercentInput

  const handleShowDiscount = (itemId: string) => {
    setShowDiscountIds((prev) => new Set([...prev, itemId]))
    requestAnimationFrame(() => discountInputRefs.current.get(itemId)?.focus())
  }

  const handleHideDiscount = (itemId: string) => {
    onUpdateItem(itemId, (current) => ({ ...current, discountPercentInput: '' }))
    setShowDiscountIds((prev) => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <ReceiptImportPanel
        onReceiptFileSelected={onReceiptFileSelected}
        onScanReceipt={onScanReceipt}
        onLoadMockReceipt={() => {}}
        hideModelInAdvancedSettings
        enableCameraCapture
        showLoadMockButton={false}
      />

      {mockReceipts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mockReceipts.map(({ label, onLoad }, index) => (
            <button
              key={label}
              type="button"
              data-testid={`load-mock-receipt-btn-${index}`}
              onClick={onLoad}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-slate-500 hover:bg-slate-700 hover:text-slate-200"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {hasAnyValidReceiptItem(items) ? (
        <div className="space-y-4">
          <SplitTotalsCard
            split={split}
            discount={discount}
            serviceCharge={serviceCharge}
            gst={gst}
            reconciliationCents={reconciliationCents}
            onApplyDiscount={onApplyDiscount}
          />

          <GlobalChargesSection
            discount={discount}
            onDiscountChange={onDiscountChange}
            serviceCharge={serviceCharge}
            onServiceChargeChange={onServiceChargeChange}
            gst={gst}
            onGstChange={onGstChange}
            receiptTotalInput={receiptTotalInput}
            onReceiptTotalInputChange={onReceiptTotalInputChange}
          />

          {/* Card: Items */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">Items</p>
              <button
                type="button"
                onClick={onAddItem}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
              >
                + Add Item
              </button>
            </div>

            {/* Column headers */}
            <div className="mb-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Item
              </span>
              <span className="w-16 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Price ($)
              </span>
              <span className="w-7" />
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const discountVisible = isDiscountVisible(item)
                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-700/60 bg-slate-900/60 focus-within:border-slate-600"
                  >
                    {/* Row 1: name | price | × */}
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 p-1">
                      <input
                        value={item.name}
                        onChange={(event) =>
                          onUpdateItem(item.id, (current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Item name"
                        className="min-w-0 rounded-lg border border-transparent bg-transparent px-1 py-1.5 text-sm text-slate-100 outline-none ring-sky-400/70 placeholder:text-slate-600 transition hover:border-slate-700 focus:border-slate-600 focus:ring-2"
                      />
                      {/* Price with $ prefix */}
                      <div className="flex w-16 items-center gap-1 rounded-lg border border-transparent px-1 py-1.5 text-sm transition hover:border-slate-700 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-sky-400/70">
                        <span className="select-none text-slate-500">$</span>
                        <input
                          value={item.amountInput}
                          onChange={(event) =>
                            onUpdateItem(item.id, (current) => ({
                              ...current,
                              amountInput: event.target.value,
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className="w-full bg-transparent text-right text-slate-100 outline-none placeholder:text-slate-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label="Remove item"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Row 2: discount (conditional) or add-discount link */}
                    {discountVisible ? (
                      <>
                        <div className="border-t border-slate-700/40" />
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="shrink-0 text-xs text-slate-500">Discount</span>
                          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-1 text-sm focus-within:ring-2 focus-within:ring-sky-400/70">
                            <input
                              ref={(el) => {
                                if (el) discountInputRefs.current.set(item.id, el)
                                else discountInputRefs.current.delete(item.id)
                              }}
                              value={item.discountPercentInput}
                              onChange={(event) =>
                                onUpdateItem(item.id, (current) => ({
                                  ...current,
                                  discountPercentInput: event.target.value,
                                }))
                              }
                              inputMode="decimal"
                              placeholder="0"
                              className="w-12 bg-transparent text-right text-slate-100 outline-none placeholder:text-slate-600"
                            />
                            <span className="select-none text-slate-500">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleHideDiscount(item.id)}
                            className="ml-auto text-xs text-slate-500 transition hover:text-slate-300 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="px-3 pb-2">
                        <button
                          type="button"
                          onClick={() => handleShowDiscount(item.id)}
                          className="text-xs text-slate-600 transition hover:text-slate-400 hover:underline"
                        >
                          + Add discount
                        </button>
                      </div>
                    )}

                    {/* Row 3: global discount indicator */}
                    {discount.enabled ? (
                      <>
                        <div className="border-t border-slate-700/40" />
                        <div className="flex items-center gap-2 px-3 py-1.5">
                          <span
                            data-testid="global-discount-badge"
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                          >
                            {discount.mode === 'percent'
                              ? `${discount.percentInput || '0'}% whole-bill discount applied`
                              : 'Whole-bill discount applied'}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-slate-500">
          Scan a receipt first, then verify the charges and items before continuing.
        </p>
      )}
    </div>
  )
}

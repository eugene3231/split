import { formatCurrencyFromCents, parseNumber } from '../../../../shared/logic/core/money'
import type { ChargeState, Person, SplitResult } from '../../../../shared/types'
import { PersonAvatar } from './PersonAvatar'

interface ReceiptBreakdownEntry {
  name: string
  split: SplitResult
}

interface Props {
  person: Person
  colorIndex: number
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  showDetails?: boolean
  receiptBreakdown?: ReceiptBreakdownEntry[]
}

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`
  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput)
    if (parsed !== null) return `${label} (${parsed.toFixed(2).replace(/\.?0+$/, '')}%)`
    return `${label} (%)`
  }
  return label
}

export function PersonCard({ person, colorIndex, split, discount, serviceCharge, gst, showDetails = false, receiptBreakdown }: Props) {
  const lines = split.lineItemsByPerson[person.id] ?? []
  const total = split.totalByPersonCents[person.id] ?? 0
const discountAmt = split.discountByPersonCents[person.id] ?? 0
  const serviceAmt = split.serviceByPersonCents[person.id] ?? 0
  const gstAmt = split.gstByPersonCents[person.id] ?? 0
  const globalChargesTotal = serviceAmt + gstAmt - discountAmt

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <PersonAvatar name={person.name} colorIndex={colorIndex} />
          <h3 className="text-2xl font-bold text-primary">{person.name}</h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-semibold tracking-widest text-on-surface-variant block leading-none mb-1">
            {receiptBreakdown ? 'Total Consolidated' : 'Total Due'}
          </span>
          <p className="text-3xl font-semibold text-on-surface leading-none font-headline">
            {formatCurrencyFromCents(total)}
          </p>
        </div>
      </div>

      {/* Receipt totals summary (collapsed view) */}
      {!showDetails && receiptBreakdown && receiptBreakdown.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {receiptBreakdown.map((entry) => {
            const entryLines = (entry.split.lineItemsByPerson[person.id] ?? []).filter((l) => l.involved)
            const entrySubtotalCents = entryLines.reduce((sum, l) => sum + l.assignedAmountCents, 0)
            if ((entry.split.lineItemsByPerson[person.id] ?? []).length === 0) return null
            return (
              <div key={entry.name} className="flex justify-between text-base text-on-surface-variant">
                <span className="truncate pr-3">{entry.name}</span>
                <span className="flex-shrink-0">{formatCurrencyFromCents(entrySubtotalCents)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Itemized shares */}
      {showDetails && <div className="space-y-3 flex-grow mt-2">
        {receiptBreakdown ? (
          // Multi-receipt: each receipt as its own card
          receiptBreakdown.length === 0 ? (
            <p className="text-xs text-outline italic">No items assigned.</p>
          ) : (
            <div className="space-y-3">
              {receiptBreakdown.map((entry) => {
                const entryLines = entry.split.lineItemsByPerson[person.id] ?? []
                const involvedLines = entryLines.filter((l) => l.involved)
                const entrySubtotalCents = involvedLines.reduce((sum, l) => sum + l.assignedAmountCents, 0)
                const entryDiscountAmt = entry.split.discountByPersonCents[person.id] ?? 0
                const entryServiceAmt = entry.split.serviceByPersonCents[person.id] ?? 0
                const entryGstAmt = entry.split.gstByPersonCents[person.id] ?? 0
                const hasCharges = entryDiscountAmt > 0 || entryServiceAmt > 0 || entryGstAmt > 0
                if (entryLines.length === 0) return null
                return (
                  <div key={entry.name} className="bg-surface-container-low rounded-xl p-5">
                    <div className="flex justify-between items-baseline mb-4">
                      <span className="text-base font-bold text-on-surface">{entry.name}</span>
                      <span className="text-base font-bold text-on-surface">{formatCurrencyFromCents(entrySubtotalCents)}</span>
                    </div>
                    <div className="border-t border-outline-variant/15 pt-3 space-y-3">
                      {entryLines.map((line, i) => (
                        <div key={`${line.itemId}-${i}`} className="flex justify-between text-base pl-4">
                          <span className={line.involved ? 'text-on-surface-variant truncate pr-4' : 'text-on-surface-variant/40 truncate pr-4 italic'}>
                            {line.name}
                          </span>
                          <span className={line.involved ? 'text-on-surface-variant flex-shrink-0' : 'text-on-surface-variant/40 flex-shrink-0 italic'}>
                            {line.involved ? formatCurrencyFromCents(line.assignedAmountCents) : '—'}
                          </span>
                        </div>
                      ))}
                      {hasCharges && (
                        <>
                          <div className="border-t border-outline-variant/40" />
                          {entryDiscountAmt > 0 && (
                            <div className="flex justify-between text-base pl-4">
                              <span className="text-on-surface-variant italic">{buildChargeLabel('Discount', discount)}</span>
                              <span className="text-on-surface-variant italic">−{formatCurrencyFromCents(entryDiscountAmt)}</span>
                            </div>
                          )}
                          {entryServiceAmt > 0 && (
                            <div className="flex justify-between text-base pl-4">
                              <span className="text-on-surface-variant italic">{buildChargeLabel('Service Charge', serviceCharge)}</span>
                              <span className="text-on-surface-variant italic">+{formatCurrencyFromCents(entryServiceAmt)}</span>
                            </div>
                          )}
                          {entryGstAmt > 0 && (
                            <div className="flex justify-between text-base pl-4">
                              <span className="text-on-surface-variant italic">{buildChargeLabel('GST / Tax', gst)}</span>
                              <span className="text-on-surface-variant italic">+{formatCurrencyFromCents(entryGstAmt)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          // Single receipt: card with items + charges
          <div className="bg-surface-container-low rounded-xl p-5">
            {lines.length === 0 ? (
              <p className="text-sm text-on-surface-variant italic">No items assigned.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={`${line.itemId}-${i}`} className="flex justify-between text-base pl-4">
                    <span className={line.involved ? 'text-on-surface-variant truncate pr-4' : 'text-on-surface-variant/40 truncate pr-4 italic'}>
                      {line.name}
                    </span>
                    <span className={line.involved ? 'text-on-surface-variant flex-shrink-0' : 'text-on-surface-variant/40 flex-shrink-0 italic'}>
                      {line.involved ? formatCurrencyFromCents(line.assignedAmountCents) : '—'}
                    </span>
                  </div>
                ))}
                {(serviceAmt > 0 || gstAmt > 0 || discountAmt > 0) && (
                  <div className="border-t border-outline-variant/15 pt-3 space-y-3">
                    {discountAmt > 0 && (
                      <div className="flex justify-between text-base pl-4">
                        <span className="text-on-surface-variant italic">{buildChargeLabel('Discount', discount)}</span>
                        <span className="text-on-surface-variant italic">−{formatCurrencyFromCents(discountAmt)}</span>
                      </div>
                    )}
                    {serviceAmt > 0 && (
                      <div className="flex justify-between text-base pl-4">
                        <span className="text-on-surface-variant italic">{buildChargeLabel('Service', serviceCharge)}</span>
                        <span className="text-on-surface-variant italic">+{formatCurrencyFromCents(serviceAmt)}</span>
                      </div>
                    )}
                    {gstAmt > 0 && (
                      <div className="flex justify-between text-base pl-4">
                        <span className="text-on-surface-variant italic">{buildChargeLabel('GST / Tax', gst)}</span>
                        <span className="text-on-surface-variant italic">+{formatCurrencyFromCents(gstAmt)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>}
    </div>
  )
}

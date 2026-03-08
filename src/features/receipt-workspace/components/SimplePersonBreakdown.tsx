import { useState, useEffect, useCallback } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { ChargeState, Person, PersonReceiptLineItem, SplitResult } from '../../../shared/types'
import { formatCurrencyFromCents, parseNumber } from '../../../shared/logic/core/money'
import { SummaryRow } from '../../split-summary/components/SummaryRow'
import { getPersonColor } from '../../../shared/utils/personColors'

type Props = {
  people: Person[]
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
}

export type PersonCardProps = {
  person: Person
  colorIndex: number
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  showItemMeta?: boolean
}

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`
  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput)
    if (parsed !== null) return `${label} (${formatPercent(parsed)}%)`
    return `${label} (%)`
  }
  return `${label} (amount)`
}

function buildItemSubMeta(line: PersonReceiptLineItem): string {
  const details: string[] = []
  if (line.discountAmountCents > 0) {
    details.push(`discount ${formatPercent(line.discountPercent)}%`)
  }
  details.push(`split among ${line.splitCount}`)
  return details.join(' · ')
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

export function PersonCard({ person, colorIndex, split, discount, serviceCharge, gst, showItemMeta = true }: PersonCardProps) {
  const personLines = split.lineItemsByPerson[person.id] ?? []
  const total = split.totalByPersonCents[person.id] ?? 0
  const color = getPersonColor(colorIndex)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-lg shadow-black/20">
      {/* Colored header */}
      <div className={`${color.lightBg} ${color.border} border-b px-4 py-3`}>
        <p className="text-sm font-bold text-slate-100">{person.name}</p>
        <p className={`text-lg font-bold ${color.accent}`}>
          {formatCurrencyFromCents(total)}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 pb-5 text-sm">
        <div className="space-y-1.5 pb-3">
          {personLines.length === 0 ? (
            <p className="text-xs text-slate-500">No assigned line items yet.</p>
          ) : (
            personLines.map((line, index) => (
              <div key={`${line.itemId}-${index}`} className="space-y-0.5">
                <div className="flex items-start justify-between gap-3 text-xs leading-tight">
                  <p className="break-words text-slate-300">{line.name}</p>
                  <p className="shrink-0 font-medium text-slate-200">
                    {formatCurrencyFromCents(line.assignedAmountCents)}
                  </p>
                </div>
                {showItemMeta ? (
                  <p className="pl-3 text-[10px] leading-tight text-slate-600">
                    {buildItemSubMeta(line)}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-auto border-t border-slate-800 pt-3 space-y-1.5">
          <SummaryRow
            label="Items"
            value={formatCurrencyFromCents(split.subtotalByPersonCents[person.id] ?? 0)}
          />
          {(split.discountByPersonCents[person.id] ?? 0) > 0 ? (
            <SummaryRow
              label={buildChargeLabel('Discount', discount)}
              value={`−${formatCurrencyFromCents(split.discountByPersonCents[person.id] ?? 0)}`}
              tone="ok"
            />
          ) : null}
          <SummaryRow
            label={buildChargeLabel('Service', serviceCharge)}
            value={formatCurrencyFromCents(split.serviceByPersonCents[person.id] ?? 0)}
          />
          <SummaryRow
            label={buildChargeLabel('GST', gst)}
            value={formatCurrencyFromCents(split.gstByPersonCents[person.id] ?? 0)}
          />
          <SummaryRow
            label="Pay"
            value={formatCurrencyFromCents(total)}
            emphasized
          />
        </div>
      </div>
    </article>
  )
}

export function SimplePersonBreakdown({ people, split, discount, serviceCharge, gst }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'center' })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  if (people.length === 0) {
    return <p className="text-sm text-slate-500">Add people to see totals.</p>
  }

  return (
    <>
      {/* Mobile: horizontal swipe carousel */}
      <div className="sm:hidden">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {people.map((person, index) => (
              <div key={person.id} className="min-w-0 flex-[0_0_100%]">
                <PersonCard
                  person={person}
                  colorIndex={index}
                  split={split}
                  discount={discount}
                  serviceCharge={serviceCharge}
                  gst={gst}
                />
              </div>
            ))}
          </div>
        </div>

        {people.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2">
            {people.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`Go to person ${i + 1}`}
                className={
                  i === selectedIndex
                    ? 'h-2 w-2 rounded-full bg-sky-400 transition'
                    : 'h-2 w-2 rounded-full bg-slate-700 transition hover:bg-slate-500'
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Tablet (sm-md): 2-column grid, Desktop (lg+): 3-column grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {people.map((person, index) => (
          <PersonCard
            key={person.id}
            person={person}
            colorIndex={index}
            split={split}
            discount={discount}
            serviceCharge={serviceCharge}
            gst={gst}
          />
        ))}
      </div>
    </>
  )
}

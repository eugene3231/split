import { useState, useEffect, useCallback } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { ChargeState, Person, PersonReceiptLineItem, SplitResult } from '../../../shared/types'
import { formatCurrencyFromCents, parseNumber } from '../../../shared/logic/core/money'
import { SummaryRow } from '../../split-summary/components/SummaryRow'

type Props = {
  people: Person[]
  split: SplitResult
  serviceCharge: ChargeState
  gst: ChargeState
}

type PersonCardProps = {
  person: Person
  split: SplitResult
  serviceCharge: ChargeState
  gst: ChargeState
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
  return details.join(' • ')
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function PersonCard({ person, split, serviceCharge, gst }: PersonCardProps) {
  const personLines = split.lineItemsByPerson[person.id] ?? []
  const total = split.totalByPersonCents[person.id] ?? 0

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
      <div>
        <p className="text-base font-bold text-slate-100">{person.name}</p>
        <p className="mt-0.5 text-lg font-semibold text-sky-300">
          {formatCurrencyFromCents(total)}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          {personLines.length === 0 ? (
            <p className="text-xs text-slate-400">No assigned line items yet.</p>
          ) : (
            personLines.map((line, index) => (
              <div key={`${line.itemId}-${index}`} className="space-y-0.5">
                <div className="flex items-center justify-between gap-3 text-xs leading-tight">
                  <p className="truncate text-slate-300">{line.name}</p>
                  <p className="shrink-0 font-medium text-slate-100">
                    {formatCurrencyFromCents(line.assignedAmountCents)}
                  </p>
                </div>
                <p className="pl-4 text-[10px] leading-tight text-slate-500">
                  {buildItemSubMeta(line)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-800 pt-3 space-y-1.5">
          <SummaryRow
            label="Items"
            value={formatCurrencyFromCents(split.subtotalByPersonCents[person.id] ?? 0)}
          />
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

export function SimplePersonBreakdown({ people, split, serviceCharge, gst }: Props) {
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
    return <p className="text-sm text-slate-400">Add people to see totals.</p>
  }

  return (
    <>
      {/* Mobile: horizontal swipe carousel */}
      <div className="sm:hidden">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {people.map((person) => (
              <div key={person.id} className="min-w-0 flex-[0_0_100%]">
                <PersonCard
                  person={person}
                  split={split}
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
                    : 'h-2 w-2 rounded-full bg-slate-600 transition hover:bg-slate-500'
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Tablet (sm-md): 2-column grid, Desktop (lg+): 3-column grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {people.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            split={split}
            serviceCharge={serviceCharge}
            gst={gst}
          />
        ))}
      </div>
    </>
  )
}

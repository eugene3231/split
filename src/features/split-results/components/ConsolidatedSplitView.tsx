import { useState, useCallback, useEffect } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { Person, Receipt, SplitResult } from '@shared/types'
import { formatCurrencyFromCents } from '@shared/logic/core/money'
import { getPersonColor } from '@shared/utils/personColors'
import { ExportConsolidatedSplitImageSection } from '@features/split-results/components/ExportConsolidatedSplitImageSection'

type Props = {
  people: Person[]
  consolidatedSplit: SplitResult
  splitByReceipt: SplitResult[]
  receipts: Receipt[]
}

function buildItemSubMeta(line: { discountAmountCents: number; discountPercent: number; splitCount: number }): string {
  const details: string[] = []
  if (line.discountAmountCents > 0) {
    details.push(`discount ${line.discountPercent.toFixed(2).replace(/\.?0+$/, '')}%`)
  }
  details.push(`split among ${line.splitCount}`)
  return details.join(' · ')
}

function PersonTotalCard({
  person,
  colorIndex,
  consolidatedSplit,
  splitByReceipt,
  receipts,
  showLineItems,
  showDetails,
}: {
  person: Person
  colorIndex: number
  consolidatedSplit: SplitResult
  splitByReceipt: SplitResult[]
  receipts: Receipt[]
  showLineItems: boolean
  showDetails: boolean
}) {
  const total = consolidatedSplit.totalByPersonCents[person.id] ?? 0
  const color = getPersonColor(colorIndex)
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-lg shadow-black/20">
      <div className={`${color.lightBg} ${color.border} border-b px-4 py-2.5 flex items-center justify-between`}>
        <p className="text-sm font-bold text-slate-100">{person.name}</p>
        <p className={`text-base font-bold ${color.accent}`}>{formatCurrencyFromCents(total)}</p>
      </div>
      <div className="space-y-3 px-4 py-3 text-xs text-slate-400">
        {receipts.map((r, rIndex) => {
          const receiptSplit = splitByReceipt[rIndex]
          const personTotal = receiptSplit?.totalByPersonCents[person.id] ?? 0
          if (personTotal === 0) return null
          const lineItems = receiptSplit?.lineItemsByPerson[person.id] ?? []
          return (
            <div key={r.id} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-300">{r.name || `Receipt ${rIndex + 1}`}</span>
                <span className="font-medium text-slate-300">{formatCurrencyFromCents(personTotal)}</span>
              </div>
              {showLineItems && lineItems.map((line) => (
                <div key={line.itemId} className={`space-y-0.5 pl-3 ${line.involved ? '' : 'opacity-35'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`break-words ${line.involved ? 'text-slate-300' : 'italic text-slate-400'}`}>{line.name}</span>
                    <span className={`shrink-0 ${line.involved ? 'font-medium text-slate-200' : 'italic text-slate-400'}`}>
                      {formatCurrencyFromCents(line.involved ? line.assignedAmountCents : line.grossAmountCents)}
                    </span>
                  </div>
                  {showDetails ? (
                    <p className="text-[10px] leading-tight text-slate-500">
                      {line.involved ? buildItemSubMeta(line) : 'not involved'}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </article>
  )
}

export function ConsolidatedSplitView({ people, consolidatedSplit, splitByReceipt, receipts }: Props) {
  const [showLineItems, setShowLineItems] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'center' })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, onSelect])

  return (
    <div className="space-y-4">
      <ExportConsolidatedSplitImageSection
        people={people}
        consolidatedSplit={consolidatedSplit}
        splitByReceipt={splitByReceipt}
        receipts={receipts}
      />

      {/* Grand total card */}
      <article className="overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-lg shadow-black/20">
        <div className="border-b border-sky-500/50 bg-sky-500/15 px-4 py-3">
          <p className="text-sm font-bold text-slate-100">Grand Total</p>
          <p className="text-lg font-bold text-sky-300">{formatCurrencyFromCents(consolidatedSplit.grandTotalCents)}</p>
        </div>
        <div className="space-y-1.5 p-4 text-xs text-slate-400">
          {receipts.map((r, index) => {
            const receiptSplit = splitByReceipt[index]
            if (!receiptSplit) return null
            return (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <span>{r.name || `Receipt ${index + 1}`}</span>
                <span className="font-medium text-slate-300">{formatCurrencyFromCents(receiptSplit.grandTotalCents)}</span>
              </div>
            )
          })}
        </div>
      </article>

      {/* Per-person totals */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">Per-person totals</p>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
              <input
                type="checkbox"
                checked={showLineItems}
                onChange={(e) => setShowLineItems(e.target.checked)}
                className="accent-sky-400"
              />
              Line items
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
                className="accent-sky-400"
              />
              Show details
            </label>
          </div>
        </div>
        {/* Mobile: horizontal swipe carousel */}
        <div className="sm:hidden">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-3">
              {people.map((person, index) => (
                <div key={person.id} className="min-w-0 flex-[0_0_100%]">
                  <PersonTotalCard
                    person={person}
                    colorIndex={index}
                    consolidatedSplit={consolidatedSplit}
                    splitByReceipt={splitByReceipt}
                    receipts={receipts}
                    showLineItems={showLineItems}
                    showDetails={showDetails}
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
            <PersonTotalCard
              key={person.id}
              person={person}
              colorIndex={index}
              consolidatedSplit={consolidatedSplit}
              splitByReceipt={splitByReceipt}
              receipts={receipts}
              showLineItems={showLineItems}
              showDetails={showDetails}
            />
          ))}
        </div>
      </div>

      {consolidatedSplit.unassignedItemCount > 0 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-300">
          {consolidatedSplit.unassignedItemCount} item(s) across receipts are unassigned and not included in totals.
        </p>
      ) : null}
    </div>
  )
}

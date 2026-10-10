import { formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import type { PrototypeReceipt } from '@features/ux-prototypes/logic/prototypeReceipt';
import { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { OverviewGrid } from './OverviewGrid';
import { OverviewSettlePanel } from './OverviewSettlePanel';

export function OverviewPrototype({ receipt }: { receipt: PrototypeReceipt }) {
  const { receiptName, people, items, assignments, split } = usePrototypeSplit(receipt);

  return (
    <div className="min-h-screen bg-overview-bg font-prototype-sans text-overview-ink">
      <header className="border-b border-overview-line bg-overview-panel">
        <div className="mx-auto max-w-[1400px] px-5 pt-16 pb-5">
          <p className="text-xs font-medium text-overview-muted">Overview · SGD</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-balance">
            {receiptName}
          </h1>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-[11px] font-medium text-overview-muted">Total</p>
              <p className="text-3xl font-bold tracking-tight tabular-nums">
                {formatMoney(split.grandTotalCents)}
              </p>
            </div>
            <p className="pb-1 text-xs text-overview-muted tabular-nums">
              {formatMoney(split.subtotalCents)} items · {formatMoney(split.serviceChargeCents)}{' '}
              service · {formatMoney(split.gstCents)} GST
            </p>
            {split.unassignedItemCount > 0 && (
              <span className="mb-1 rounded-md bg-overview-warn-bg px-2.5 py-1 text-xs font-semibold text-overview-warn">
                {split.unassignedItemCount} unassigned
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <OverviewSettlePanel people={people} split={split} className="xl:order-2" />
        <OverviewGrid
          people={people}
          items={items}
          assignments={assignments}
          split={split}
          className="xl:order-1"
        />
      </main>
    </div>
  );
}

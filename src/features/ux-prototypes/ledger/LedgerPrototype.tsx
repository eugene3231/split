import { formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import type { PrototypeReceipt } from '@features/ux-prototypes/logic/prototypeReceipt';
import { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { LedgerGrid } from './LedgerGrid';
import { LedgerSettlePanel } from './LedgerSettlePanel';

export function LedgerPrototype({ receipt }: { receipt: PrototypeReceipt }) {
  const prototype = usePrototypeSplit(receipt);
  const { split } = prototype;

  return (
    <div className="min-h-screen bg-ledger-bg font-prototype-sans text-ledger-ink">
      <header className="border-b border-ledger-line bg-ledger-panel">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-x-8 gap-y-3 px-5 pt-16 pb-4">
          <div className="mr-auto max-w-2xl min-w-0">
            <p className="text-xs font-medium text-ledger-muted">Receipt 1 of 1 · SGD</p>
            <h1 className="text-xl font-semibold tracking-tight">{prototype.receiptName}</h1>
          </div>
          <Stat label="Subtotal" cents={split.subtotalCents} />
          <Stat label="Service 10%" cents={split.serviceChargeCents} />
          <Stat label="GST 9%" cents={split.gstCents} />
          <Stat label="Total" cents={split.grandTotalCents} />
          {split.unassignedItemCount > 0 && (
            <div className="rounded-md bg-ledger-warn-bg px-2.5 py-1.5 text-xs font-semibold text-ledger-warn">
              {split.unassignedItemCount} unassigned
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <LedgerGrid prototype={prototype} />
        <LedgerSettlePanel people={prototype.people} split={split} />
      </main>
    </div>
  );
}

function Stat({ label, cents }: { label: string; cents: number }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-ledger-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{formatMoney(cents)}</p>
    </div>
  );
}

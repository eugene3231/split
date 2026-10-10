import { useState } from 'react';
import type { Person } from '@shared/types';
import {
  getTransferKey,
  resolveBalances,
  resolveTransfers,
  type SettleUpReceipt,
} from '../logic/settleUp';
import { BalanceList } from './BalanceList';
import { CopySummaryButton } from './CopySummaryButton';
import { CreditorMobiles } from './CreditorMobiles';
import { PayerPicker } from './PayerPicker';
import { TransferList } from './TransferList';

interface SettleUpBoardProps {
  people: Person[];
  receipts: SettleUpReceipt[];
  initialPayers: Record<string, string>;
}

export function SettleUpBoard({ people, receipts, initialPayers }: SettleUpBoardProps) {
  const [payerByReceiptId, setPayerByReceiptId] = useState(initialPayers);
  const [mobileByPersonId, setMobileByPersonId] = useState<Record<string, string>>({});
  const [settledKeys, setSettledKeys] = useState<Set<string>>(new Set());

  const balances = resolveBalances(people, receipts, payerByReceiptId);
  const transfers = resolveTransfers(balances);
  const creditors = people.filter((person) =>
    balances.some((b) => b.personId === person.id && b.netCents > 0),
  );
  const settledCount = transfers.filter((t) => settledKeys.has(getTransferKey(t))).length;

  const toggleSettled = (key: string) =>
    setSettledKeys((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
      <section>
        <SectionHeading title="Who paid?" />
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <PayerPicker
              key={receipt.id}
              receipt={receipt}
              people={people}
              payerId={payerByReceiptId[receipt.id]}
              onPayerChange={(personId) =>
                setPayerByReceiptId((prev) => ({ ...prev, [receipt.id]: personId }))
              }
            />
          ))}
        </div>
      </section>

      <div className="space-y-10">
        <section>
          <SectionHeading
            title="Transfers"
            aside={transfers.length > 0 ? `${settledCount} of ${transfers.length} paid` : undefined}
          />
          <TransferList
            people={people}
            transfers={transfers}
            settledKeys={settledKeys}
            mobileByPersonId={mobileByPersonId}
            onToggleSettled={toggleSettled}
          />
          {transfers.length > 0 && (
            <div className="mt-4">
              <CopySummaryButton people={people} transfers={transfers} />
            </div>
          )}
        </section>

        {creditors.length > 0 && (
          <section>
            <SectionHeading title="PayNow numbers" />
            <CreditorMobiles
              creditors={creditors}
              people={people}
              mobileByPersonId={mobileByPersonId}
              onMobileChange={(personId, mobile) =>
                setMobileByPersonId((prev) => ({ ...prev, [personId]: mobile }))
              }
            />
          </section>
        )}

        <section>
          <SectionHeading title="Balances" />
          <BalanceList people={people} balances={balances} />
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
        {title}
      </h2>
      {aside && <span className="text-xs font-semibold text-secondary">{aside}</span>}
    </div>
  );
}

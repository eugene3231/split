import type { Receipt } from '@shared/types';
import {
  AddReceiptButton,
  ReceiptTab,
  ReceiptTabs,
} from '@features/split-workspace/components/shared/ReceiptTabs';

interface Props {
  receipts: Receipt[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onRenameReceipt: (id: string, name: string) => void;
  onAddReceipt?: () => void;
}

export function SummaryTabs({
  receipts,
  activeTab,
  onTabChange,
  onRenameReceipt,
  onAddReceipt,
}: Props) {
  return (
    <ReceiptTabs
      action={
        onAddReceipt && (
          <AddReceiptButton data-testid="summary-add-receipt-btn" onClick={onAddReceipt} />
        )
      }
    >
      {receipts.length > 1 && (
        <ReceiptTab
          label={`Total · ${receipts.length} receipts`}
          isActive={activeTab === 'total'}
          onSelect={() => onTabChange('total')}
          data-testid="summary-tab-total"
        />
      )}
      {receipts.map((receipt, index) => (
        <ReceiptTab
          key={receipt.id}
          label={receipt.name || `Receipt ${index + 1}`}
          isActive={activeTab === receipt.id}
          onSelect={() => onTabChange(receipt.id)}
          onRename={(name) => onRenameReceipt(receipt.id, name)}
          data-testid={`summary-tab-receipt-${index}`}
        />
      ))}
    </ReceiptTabs>
  );
}

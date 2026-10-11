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
      value={activeTab}
      onValueChange={onTabChange}
      action={
        onAddReceipt && (
          <AddReceiptButton data-testid="summary-add-receipt-btn" onClick={onAddReceipt} />
        )
      }
    >
      {receipts.length > 1 && (
        <ReceiptTab
          value="total"
          label={`Total · ${receipts.length} receipts`}
          data-testid="summary-tab-total"
        />
      )}
      {receipts.map((receipt, index) => (
        <ReceiptTab
          key={receipt.id}
          value={receipt.id}
          label={receipt.name || `Receipt ${index + 1}`}
          onRename={(name) => onRenameReceipt(receipt.id, name)}
          data-testid={`summary-tab-receipt-${index}`}
        />
      ))}
    </ReceiptTabs>
  );
}

import type { GroupId } from '@features/group-ledger/domain/types';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { Sheet } from '@features/group-ledger/components/ui/Sheet';
import { Link, type Route } from '@shared/routing';

interface AddSheetProps {
  groupId: GroupId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSheet({ groupId, open, onOpenChange }: AddSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add an expense">
      <div className="grid gap-3">
        <AddChoice
          to={{ kind: 'newExpense', groupId }}
          icon="edit_note"
          title="Quick expense"
          body="An amount, who paid, who it's for."
        />
        <AddChoice
          to={{ kind: 'receipt', groupId }}
          icon="receipt_long"
          title="Scan a receipt"
          body="Split it item by item."
        />
      </div>
    </Sheet>
  );
}

function AddChoice({
  to,
  icon,
  title,
  body,
}: {
  to: Route;
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-surface-container-highest bg-surface-container-lowest p-4 transition hover:border-outline-variant active:scale-[0.99]"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface">
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-on-surface">{title}</span>
        <span className="block text-sm text-on-surface-variant">{body}</span>
      </span>
      <Icon name="chevron_right" className="text-outline" />
    </Link>
  );
}

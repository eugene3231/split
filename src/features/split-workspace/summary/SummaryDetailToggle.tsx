import type { ReactNode } from 'react';
import type { SummaryDetail } from '@features/split-workspace/summary/breakdown/types';
import { ItemListIcon } from './ItemListIcon';
import { PillToggle } from './PillToggle';

const OPTIONS: { value: SummaryDetail; label: string; icon: ReactNode }[] = [
  { value: 'totals', label: 'Totals', icon: <ItemListIcon rows={1} /> },
  { value: 'their-items', label: 'Their items', icon: <ItemListIcon rows={2} /> },
  { value: 'all-items', label: 'All items', icon: <ItemListIcon rows={4} /> },
];

interface Props {
  detail: SummaryDetail;
  onDetailChange: (detail: SummaryDetail) => void;
  className?: string;
}

export function SummaryDetailToggle({ detail, onDetailChange, className }: Props) {
  return (
    <PillToggle
      label="Show on each card"
      options={OPTIONS}
      value={detail}
      onChange={onDetailChange}
      className={className}
    />
  );
}

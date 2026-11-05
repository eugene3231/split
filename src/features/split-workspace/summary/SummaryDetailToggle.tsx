import type { SummaryDetail } from '@features/split-workspace/summary/breakdown/types';
import { PillToggle } from './PillToggle';

const OPTIONS: { value: SummaryDetail; label: string }[] = [
  { value: 'totals', label: 'Totals' },
  { value: 'their-items', label: 'Their items' },
  { value: 'all-items', label: 'All items' },
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

import { PillToggle } from './PillToggle';

export type SummaryDetail = 'totals' | 'their-items' | 'all-items';

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

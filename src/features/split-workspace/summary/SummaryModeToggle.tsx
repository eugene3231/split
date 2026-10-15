import { SegmentedToggle } from '@features/split-workspace/components/shared/SegmentedToggle';

export type SummaryMode = 'by-person' | 'overview';

const MODES = [
  { value: 'by-person', label: 'By person' },
  { value: 'overview', label: 'Overview' },
] as const;

interface Props {
  mode: SummaryMode;
  onModeChange: (mode: SummaryMode) => void;
}

export function SummaryModeToggle({ mode, onModeChange }: Props) {
  return (
    <SegmentedToggle
      label="Summary view"
      options={MODES}
      value={mode}
      onValueChange={onModeChange}
      className="grid w-full sm:inline-grid sm:w-auto"
    />
  );
}

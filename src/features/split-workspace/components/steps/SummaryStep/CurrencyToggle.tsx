import { getCurrencySymbol } from '@shared/logic/core/money';
import { BASE_CURRENCY } from '@shared/constants';
import { PillToggle } from './PillToggle';

interface Props {
  showBaseCurrency: boolean;
  onToggle: (show: boolean) => void;
  activeTab: string;
  currentCurrency: string;
}

export function CurrencyToggle({ showBaseCurrency, onToggle, activeTab, currentCurrency }: Props) {
  const billedLabel =
    activeTab === 'total'
      ? 'As billed'
      : `${getCurrencySymbol(currentCurrency)} ${currentCurrency}`;

  return (
    <PillToggle
      label="Currency"
      options={[
        { value: 'billed', label: billedLabel },
        { value: 'base', label: `${getCurrencySymbol(BASE_CURRENCY)} ${BASE_CURRENCY}` },
      ]}
      value={showBaseCurrency ? 'base' : 'billed'}
      onChange={(value) => onToggle(value === 'base')}
    />
  );
}

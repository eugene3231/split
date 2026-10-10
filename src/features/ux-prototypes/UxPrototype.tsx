import type { ReactNode } from 'react';
import { PrototypeSwitcher } from './components/PrototypeSwitcher';
import { ClaimPrototype } from './claim/ClaimPrototype';
import { LedgerPrototype } from './ledger/LedgerPrototype';
import { PlatePrototype } from './plate/PlatePrototype';
import { DINNER_RECEIPT, STRESS_RECEIPT, type PrototypeReceipt } from './logic/prototypeReceipt';
import type { PrototypeName, PrototypeSelection } from './prototypeNames';

const PROTOTYPES = {
  plate: PlatePrototype,
  claim: ClaimPrototype,
  ledger: LedgerPrototype,
} satisfies Record<PrototypeName, (props: { receipt: PrototypeReceipt }) => ReactNode>;

export function UxPrototype({ selection }: { selection: PrototypeSelection }) {
  const Prototype = PROTOTYPES[selection.name];
  const receipt = selection.receipt === 'stress' ? STRESS_RECEIPT : DINNER_RECEIPT;
  return (
    <>
      <Prototype receipt={receipt} />
      <PrototypeSwitcher selection={selection} />
    </>
  );
}

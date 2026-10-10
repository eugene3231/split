import type { ReactNode } from 'react';
import { PrototypeSwitcher } from './components/PrototypeSwitcher';
import { ClaimPrototype } from './claim/ClaimPrototype';
import { LedgerPrototype } from './ledger/LedgerPrototype';
import { PlatePrototype } from './plate/PlatePrototype';
import type { PrototypeName } from './prototypeNames';

const PROTOTYPES = {
  plate: PlatePrototype,
  claim: ClaimPrototype,
  ledger: LedgerPrototype,
} satisfies Record<PrototypeName, () => ReactNode>;

export function UxPrototype({ name }: { name: PrototypeName }) {
  const Prototype = PROTOTYPES[name];
  return (
    <>
      <Prototype />
      <PrototypeSwitcher active={name} />
    </>
  );
}

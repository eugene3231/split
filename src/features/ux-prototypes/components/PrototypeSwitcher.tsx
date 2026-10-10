import { cn } from '@shared/utils/cn';
import {
  PROTOTYPE_NAMES,
  toPrototypeSearch,
  type PrototypeName,
  type PrototypeSelection,
} from '@features/ux-prototypes/prototypeNames';

const LABELS: Record<PrototypeName, string> = {
  plate: 'Plate',
  claim: 'Claim',
  ledger: 'Ledger',
};

const PILL = 'rounded-full px-3 py-1.5 transition-colors';

export function PrototypeSwitcher({ selection }: { selection: PrototypeSelection }) {
  const stress = selection.receipt === 'stress';
  return (
    <nav
      aria-label="Prototype directions"
      className="fixed top-3 left-1/2 z-[60] flex -translate-x-1/2 gap-1 rounded-full bg-black/80 p-1 text-xs font-semibold whitespace-nowrap text-white shadow-lg backdrop-blur"
    >
      {PROTOTYPE_NAMES.map((name) => (
        <a
          key={name}
          href={toPrototypeSearch({ ...selection, name })}
          aria-current={name === selection.name ? 'page' : undefined}
          className={cn(
            PILL,
            name === selection.name ? 'bg-white text-black' : 'hover:bg-white/15',
          )}
        >
          {LABELS[name]}
        </a>
      ))}
      <a
        href={toPrototypeSearch({ ...selection, receipt: stress ? 'dinner' : 'stress' })}
        aria-pressed={stress}
        className={cn(PILL, stress ? 'bg-amber-300 text-black' : 'text-white/70 hover:bg-white/15')}
      >
        Big group
      </a>
    </nav>
  );
}

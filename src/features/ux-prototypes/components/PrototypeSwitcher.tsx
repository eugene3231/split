import { cn } from '@shared/utils/cn';
import { PROTOTYPE_NAMES, type PrototypeName } from '@features/ux-prototypes/prototypeNames';

const LABELS: Record<PrototypeName, string> = {
  plate: 'Plate',
  claim: 'Claim',
  ledger: 'Ledger',
};

export function PrototypeSwitcher({ active }: { active: PrototypeName }) {
  return (
    <nav
      aria-label="Prototype directions"
      className="fixed top-3 left-1/2 z-[60] flex -translate-x-1/2 gap-1 rounded-full bg-black/80 p-1 text-xs font-semibold text-white shadow-lg backdrop-blur"
    >
      {PROTOTYPE_NAMES.map((name) => (
        <a
          key={name}
          href={`?prototype=${name}`}
          aria-current={name === active ? 'page' : undefined}
          className={cn(
            'rounded-full px-3 py-1.5 transition-colors',
            name === active ? 'bg-white text-black' : 'hover:bg-white/15',
          )}
        >
          {LABELS[name]}
        </a>
      ))}
    </nav>
  );
}

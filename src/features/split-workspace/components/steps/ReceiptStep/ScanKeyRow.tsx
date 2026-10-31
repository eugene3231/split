import type { ScanTransport } from '@features/receipt-scanner/logic/scanTransport';
import { cn } from '@shared/utils/cn';

interface ScanKeyRowProps {
  transport: ScanTransport['kind'];
  onEditKey: () => void;
}

const STATUS: Record<ScanTransport['kind'], { icon: string; text: string; action: string }> = {
  direct: { icon: 'key', text: 'Gemini API key set', action: 'Edit' },
  server: {
    icon: 'cloud',
    text: "Scanning with Split's shared scanner",
    action: 'Use your own key',
  },
  none: { icon: 'key_off', text: 'Gemini API key required.', action: 'Add Key' },
};

export function ScanKeyRow({ transport, onEditKey }: ScanKeyRowProps) {
  const { icon, text, action } = STATUS[transport];
  const isMissing = transport === 'none';

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'material-symbols-outlined text-sm',
          isMissing ? 'text-error' : 'text-secondary',
        )}
      >
        {icon}
      </span>
      <p
        className={cn('text-xs font-medium', isMissing ? 'text-error' : 'text-on-surface-variant')}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={onEditKey}
        className={cn(
          'cursor-pointer text-xs font-bold underline',
          isMissing ? 'text-error' : 'text-on-surface-variant hover:text-primary',
        )}
      >
        {action}
      </button>
    </div>
  );
}

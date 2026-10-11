import { normalizeMobile } from '@features/payments';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import type { Person } from '@shared/types';

interface CreditorMobilesProps {
  creditors: Person[];
  people: Person[];
  mobileByPersonId: Record<string, string>;
  onMobileChange: (personId: string, mobile: string) => void;
}

export function CreditorMobiles({
  creditors,
  people,
  mobileByPersonId,
  onMobileChange,
}: CreditorMobilesProps) {
  return (
    <div className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      <p className="mb-2 text-xs text-on-surface-variant">
        Add a number for anyone getting money back to show a PayNow QR on their transfers.
      </p>
      {creditors.map((person) => {
        const value = mobileByPersonId[person.id] ?? '';
        const invalid = value.trim() !== '' && !normalizeMobile(value);
        return (
          <label key={person.id} className="flex items-center gap-3">
            <PersonAvatar
              name={person.name}
              colorIndex={people.findIndex((p) => p.id === person.id)}
              size="sm"
            />
            <span className="w-16 truncate text-sm font-semibold text-on-surface">
              {person.name}
            </span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="+65 9123 4567"
              value={value}
              aria-invalid={invalid}
              onChange={(e) => onMobileChange(person.id, e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm aria-invalid:border-error"
            />
          </label>
        );
      })}
    </div>
  );
}

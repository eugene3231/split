import type { ClaimPersonRef } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';

interface Props {
  people: ClaimPersonRef[];
  max?: number;
}

export function AvatarStack({ people, max = 5 }: Props) {
  const shown = people.slice(0, people.length > max ? max - 1 : max);
  const hidden = people.length - shown.length;

  return (
    <span
      className="flex shrink-0 -space-x-1.5"
      title={people.map((person) => person.name).join(', ')}
    >
      {shown.map((person) => (
        <PersonAvatar
          key={person.id}
          name={person.name}
          colorIndex={person.colorIndex}
          className="h-5 w-5 text-[10px] ring-2 ring-surface-container-lowest"
        />
      ))}
      {hidden > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-on-surface-variant px-1 text-[10px] font-bold text-white ring-2 ring-surface-container-lowest">
          +{hidden}
        </span>
      )}
    </span>
  );
}

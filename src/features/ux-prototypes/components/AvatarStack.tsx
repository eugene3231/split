import type { Person } from '@shared/types';
import { Avatar } from './Avatar';

interface Props {
  people: Person[];
  personIds: string[];
  colorFor: (index: number) => string;
  ringClassName: string;
  max?: number;
}

export function AvatarStack({ people, personIds, colorFor, ringClassName, max = 4 }: Props) {
  const shown = personIds.slice(0, personIds.length > max ? max - 1 : max);
  const hidden = personIds.length - shown.length;

  return (
    <span
      className="flex -space-x-1.5"
      title={personIds.map((id) => nameOf(people, id)).join(', ')}
    >
      {shown.map((personId) => {
        const index = people.findIndex((person) => person.id === personId);
        return (
          <Avatar
            key={personId}
            name={people[index].name}
            color={colorFor(index)}
            className={`h-5 w-5 text-[10px] ring-2 ${ringClassName}`}
          />
        );
      })}
      {hidden > 0 && (
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-700 px-1 text-[10px] font-bold text-white ring-2 ${ringClassName}`}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
}

function nameOf(people: Person[], personId: string): string {
  return people.find((person) => person.id === personId)?.name ?? '';
}

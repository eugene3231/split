import { useEffect } from 'react';
import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';

interface Props {
  person: ClaimPerson;
  onExit: (personId: string) => void;
}

export function ExitingClaimantAvatar({ person, onExit }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(() => onExit(person.id), 180);
    return () => window.clearTimeout(timer);
  }, [person.id, onExit]);

  return (
    <PersonAvatar
      name={person.name}
      colorIndex={person.colorIndex}
      className="h-5 w-5 text-[10px] ring-2 ring-surface"
    />
  );
}

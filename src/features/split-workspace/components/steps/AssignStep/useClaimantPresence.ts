import { useCallback, useState } from 'react';
import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { prefersMotion } from '@features/split-workspace/components/shared/motion';

interface AvatarPresence {
  source: ClaimPerson[];
  visible: ClaimPerson[];
  displayed: ClaimPerson[];
  /** Avatars added by the latest change. Avatars there on first render do not animate in. */
  entering: ReadonlySet<string>;
}

export function useClaimantPresence(claimants: ClaimPerson[], maxAvatars: number) {
  const visible = claimants.length > maxAvatars ? claimants.slice(0, maxAvatars - 1) : claimants;
  const [presence, setPresence] = useState<AvatarPresence>({
    source: claimants,
    visible,
    displayed: visible,
    entering: new Set(),
  });

  if (presence.source !== claimants) {
    const current = new Map(visible.map((person) => [person.id, person]));
    const claimedIds = new Set(claimants.map((person) => person.id));
    const retained = presence.displayed.filter(
      (person) => current.has(person.id) || !claimedIds.has(person.id),
    );
    const retainedIds = new Set(retained.map((person) => person.id));
    const previousIds = new Set(presence.displayed.map((person) => person.id));
    setPresence({
      source: claimants,
      visible,
      entering: new Set(
        visible.filter((person) => !previousIds.has(person.id)).map((person) => person.id),
      ),
      displayed:
        prefersMotion() && retained.some((person) => !current.has(person.id))
          ? [
              ...retained.map((person) => current.get(person.id) ?? person),
              ...visible.filter((person) => !retainedIds.has(person.id)),
            ]
          : visible,
    });
  }

  const finishExit = useCallback((personId: string) => {
    setPresence((current) => {
      if (current.visible.some((person) => person.id === personId)) return current;
      const remaining = current.displayed.filter((person) => person.id !== personId);
      const hasExits = remaining.some(
        (person) => !current.visible.some((visiblePerson) => visiblePerson.id === person.id),
      );
      return { ...current, displayed: hasExits ? remaining : current.visible };
    });
  }, []);

  return {
    visible,
    finishExit,
    avatars: presence.displayed.map((person) => ({
      person,
      isExiting: !visible.some((current) => current.id === person.id),
      isEntering: presence.entering.has(person.id),
    })),
  };
}

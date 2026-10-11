import { useState } from 'react';

/** True right after the last item left gets assigned, until the count changes again. */
export function useAllAssignedMoment(leftCount: number): boolean {
  const [previous, setPrevious] = useState(leftCount);
  const [justFinished, setJustFinished] = useState(false);

  if (leftCount !== previous) {
    setPrevious(leftCount);
    setJustFinished(previous > 0 && leftCount === 0);
  }

  return justFinished;
}

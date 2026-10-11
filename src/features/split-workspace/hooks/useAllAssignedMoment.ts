import { useEffect, useState } from 'react';

export function useAllAssignedMoment(leftCount: number): boolean {
  const [previous, setPrevious] = useState(leftCount);
  const [justFinished, setJustFinished] = useState(false);

  if (leftCount !== previous) {
    setPrevious(leftCount);
    setJustFinished(previous > 0 && leftCount === 0);
  }

  useEffect(() => {
    if (!justFinished) return;
    const timer = window.setTimeout(() => setJustFinished(false), 1600);
    return () => window.clearTimeout(timer);
  }, [justFinished]);

  return justFinished;
}

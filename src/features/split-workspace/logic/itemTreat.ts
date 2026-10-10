import type { EditableItem, Person } from '@shared/types';

/** The person treating everyone to this item, while they are still on it. */
export function resolveTreaterId(item: EditableItem): string | null {
  const { treatedBy, personIds } = item.assignment;
  return treatedBy && personIds.includes(treatedBy) ? treatedBy : null;
}

/** One person covers the whole item, so nobody else can tick it. */
export function treatItem(item: EditableItem, personId: string): EditableItem {
  return {
    ...item,
    assignment: { mode: 'equal', personId: '', personIds: [personId], treatedBy: personId },
  };
}

/** Lifts the lock but leaves the treater on the item. */
export function untreatItem(item: EditableItem): EditableItem {
  if (item.assignment.treatedBy === undefined) return item;
  return { ...item, assignment: { ...item.assignment, treatedBy: undefined } };
}

export function formatTreatLabel(firstName: string): string {
  return `${firstName}'s treat`;
}

/** "Alex's treat" for a treated item, or undefined. */
export function describeTreat(treatedBy: string | undefined, people: Person[]): string | undefined {
  const treater = people.find((person) => person.id === treatedBy);
  return treater
    ? formatTreatLabel(treater.name.trim().split(/\s+/)[0] ?? treater.name)
    : undefined;
}

/** "Wine · Alex's treat" where a treat has to share the item's name. */
export function labelTreatedItem(
  name: string,
  treatedBy: string | undefined,
  people: Person[],
): string {
  const treat = describeTreat(treatedBy, people);
  return treat ? `${name} · ${treat}` : name;
}

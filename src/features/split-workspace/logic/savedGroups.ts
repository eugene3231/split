import { z } from 'zod';
import { LOCAL_STORAGE_SAVED_GROUPS_KEY } from '@features/split-workspace/constants';
import { jsonStorage, lenientArray } from '@features/split-workspace/logic/jsonStorage';
import { createId } from '@shared/logic/core/id';

const savedGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Blank names are dropped, and a group left with nobody is not a group.
  names: lenientArray(z.string().refine((name) => name.trim().length > 0)).pipe(
    z.array(z.string()).min(1),
  ),
});

export type SavedGroup = z.infer<typeof savedGroupSchema>;

const savedGroupsStorage = jsonStorage(
  'localStorage',
  LOCAL_STORAGE_SAVED_GROUPS_KEY,
  lenientArray(savedGroupSchema),
);

/** Saving under an existing group name replaces that group's names. */
export function upsertSavedGroup(
  groups: SavedGroup[],
  name: string,
  names: string[],
): SavedGroup[] {
  const trimmedName = name.trim();
  if (trimmedName.length === 0 || names.length === 0) return groups;

  const key = trimmedName.toLowerCase();
  const existing = groups.find((group) => group.name.toLowerCase() === key);
  if (existing) {
    return groups.map((group) =>
      group.id === existing.id ? { ...group, name: trimmedName, names } : group,
    );
  }
  return [...groups, { id: createId(), name: trimmedName, names }];
}

export function namesMissingFromSplit(group: SavedGroup, peopleNames: string[]): string[] {
  const present = new Set(peopleNames.map((name) => name.toLowerCase()));
  return group.names.filter((name) => !present.has(name.toLowerCase()));
}

export function loadSavedGroups(): SavedGroup[] {
  return savedGroupsStorage.load() ?? [];
}

export function saveSavedGroups(groups: SavedGroup[]): void {
  savedGroupsStorage.save(groups);
}

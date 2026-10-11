import { LOCAL_STORAGE_SAVED_GROUPS_KEY } from '@features/split-workspace/constants';
import { isRecord } from '@features/split-workspace/logic/guards';
import { createId } from '@shared/logic/core/id';

export interface SavedGroup {
  id: string;
  name: string;
  names: string[];
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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

function normalizeSavedGroup(value: unknown): SavedGroup | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (!Array.isArray(value.names)) return null;

  const names = value.names.filter(
    (name): name is string => typeof name === 'string' && name.trim().length > 0,
  );
  if (names.length === 0) return null;
  return { id: value.id, name: value.name, names };
}

export function loadSavedGroups(): SavedGroup[] {
  const storage = getBrowserStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LOCAL_STORAGE_SAVED_GROUPS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => normalizeSavedGroup(value) ?? []);
  } catch {
    return [];
  }
}

export function saveSavedGroups(groups: SavedGroup[]): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(LOCAL_STORAGE_SAVED_GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // Ignore storage write failures.
  }
}

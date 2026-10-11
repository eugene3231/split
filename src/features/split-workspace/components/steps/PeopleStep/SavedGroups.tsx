import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useSavedGroupsStore } from '@features/split-workspace/stores/savedGroupsStore';
import { namesMissingFromSplit } from '@features/split-workspace/logic/savedGroups';
import type { SavedGroup } from '@features/split-workspace/logic/savedGroups';

export function SavedGroups() {
  const groups = useSavedGroupsStore((state) => state.groups);
  const removeGroup = useSavedGroupsStore((state) => state.removeGroup);
  const { people, addPeople } = useReceiptStore(
    useShallow((state) => ({ people: state.people, addPeople: state.addPeople })),
  );
  const [isManaging, setIsManaging] = useState(false);

  if (groups.length === 0 && !isManaging) return null;

  const peopleNames = people.map((person) => person.name);

  return (
    <section data-testid="saved-groups" aria-label="Saved groups" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-on-surface-variant">Saved groups</h2>
        <button
          type="button"
          aria-expanded={isManaging}
          onClick={() => setIsManaging(!isManaging)}
          className="min-h-11 rounded-xl px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          {isManaging ? 'Done' : 'Manage groups'}
        </button>
      </div>
      {groups.length === 0 ? (
        <p className="py-4 text-sm text-on-surface-variant">No saved groups</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const missing = namesMissingFromSplit(group, peopleNames);
            if (isManaging) {
              return (
                <div
                  key={group.id}
                  className="flex items-center gap-3 rounded-2xl border border-surface-container-highest bg-surface-container-lowest p-4"
                >
                  <GroupDetails group={group} />
                  <button
                    type="button"
                    aria-label={`Delete ${group.name} group`}
                    onClick={() => removeGroup(group.id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-error transition-colors hover:bg-error/10"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined !text-xl">
                      delete
                    </span>
                  </button>
                </div>
              );
            }
            return (
              <button
                key={group.id}
                type="button"
                data-testid={`saved-group-${group.id}`}
                disabled={missing.length === 0}
                onClick={() => addPeople(missing)}
                className="flex items-center gap-3 rounded-2xl border border-surface-container-highest bg-surface-container-lowest p-4 text-left transition-colors hover:border-outline-variant disabled:hover:border-surface-container-highest"
              >
                <GroupDetails group={group} />
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined shrink-0 !text-xl text-on-surface-variant"
                >
                  {missing.length === 0 ? 'check' : 'group_add'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface GroupDetailsProps {
  group: SavedGroup;
}

function GroupDetails({ group }: GroupDetailsProps) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-on-surface">
        <span className="break-words">{group.name}</span>
        <span className="text-xs font-medium text-on-surface-variant">{group.names.length}</span>
      </span>
      <span className="mt-1 block text-sm break-words text-on-surface-variant">
        {group.names.join(', ')}
      </span>
    </span>
  );
}

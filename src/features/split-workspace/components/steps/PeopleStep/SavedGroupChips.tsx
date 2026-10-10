import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useSavedGroupsStore } from '@features/split-workspace/stores/savedGroupsStore';
import { namesMissingFromSplit } from '@features/split-workspace/logic/savedGroups';
import { cn } from '@shared/utils/cn';

export function SavedGroupChips() {
  const groups = useSavedGroupsStore((state) => state.groups);
  const removeGroup = useSavedGroupsStore((state) => state.removeGroup);
  const { people, addPeople } = useReceiptStore(
    useShallow((state) => ({ people: state.people, addPeople: state.addPeople })),
  );

  if (groups.length === 0) return null;

  const peopleNames = people.map((person) => person.name);

  return (
    <section data-testid="saved-groups" aria-label="Saved groups" className="space-y-2">
      <h3 className="px-1 text-xs font-semibold text-on-surface-variant">Saved groups</h3>
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const missing = namesMissingFromSplit(group, peopleNames);
          const allAdded = missing.length === 0;
          return (
            <div
              key={group.id}
              className={cn(
                'flex items-center rounded-full border border-surface-container-highest bg-surface-container-lowest text-sm font-semibold text-on-surface',
                allAdded && 'opacity-60',
              )}
            >
              <button
                type="button"
                data-testid={`saved-group-${group.id}`}
                disabled={allAdded}
                onClick={() => addPeople(missing)}
                title={group.names.join(', ')}
                className="flex items-center gap-1.5 rounded-l-full py-1.5 pr-1 pl-3 transition active:scale-95 disabled:active:scale-100"
              >
                <span className="material-symbols-outlined !text-base leading-none text-on-surface-variant">
                  {allAdded ? 'check' : 'group_add'}
                </span>
                {group.name}
                <span className="text-xs font-medium text-on-surface-variant">
                  {group.names.length}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${group.name} group`}
                onClick={() => removeGroup(group.id)}
                className="flex items-center rounded-r-full py-1.5 pr-2.5 pl-1 text-on-surface-variant transition hover:text-on-surface"
              >
                <span className="material-symbols-outlined !text-sm leading-none">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

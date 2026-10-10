import { useState } from 'react';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useSavedGroupsStore } from '@features/split-workspace/stores/savedGroupsStore';

export function SaveGroupForm() {
  const people = useReceiptStore((state) => state.people);
  const saveGroup = useSavedGroupsStore((state) => state.saveGroup);
  const [isOpen, setIsOpen] = useState(false);
  const [groupName, setGroupName] = useState('');

  if (people.length < 2) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="save-group-btn"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 text-sm font-semibold text-primary"
      >
        <span className="material-symbols-outlined !text-base leading-none">bookmark_add</span>
        Save as group
      </button>
    );
  }

  const close = () => {
    setIsOpen(false);
    setGroupName('');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (groupName.trim().length === 0) return;
        saveGroup(
          groupName,
          people.map((person) => person.name),
        );
        close();
      }}
      className="flex w-full gap-2"
    >
      <input
        data-testid="save-group-name-input"
        aria-label="Group name"
        autoFocus
        value={groupName}
        onChange={(event) => setGroupName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
        placeholder="Group name, e.g. Housemates"
        className="min-w-0 flex-1 rounded-xl border-none bg-surface-container px-3 py-2 text-base text-on-surface outline-none placeholder:text-outline focus:ring-0"
      />
      <button
        type="submit"
        data-testid="save-group-submit"
        disabled={groupName.trim().length === 0}
        className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={close}
        className="rounded-xl px-2 py-2 text-sm font-semibold text-on-surface-variant"
      >
        Cancel
      </button>
    </form>
  );
}

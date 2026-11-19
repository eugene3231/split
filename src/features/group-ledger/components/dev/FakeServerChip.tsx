import { useState } from 'react';
import {
  isFakeOnline,
  setFakeOffline,
  tabProfile,
} from '@features/group-ledger/backend/fakeBackend';
import { cn } from '@shared/utils/cn';

/** Dev only, on the fake server: which phone this tab is, and a switch to take it offline. */
export function FakeServerChip() {
  const [online, setOnline] = useState(isFakeOnline);
  const [phone] = useState(() => tabProfile().slice(0, 8));

  return (
    <div className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.75rem)] left-2 z-[45] flex items-center gap-2 rounded-full border border-surface-container-highest bg-surface-container-lowest/95 py-1 pr-1 pl-3 text-xs font-semibold text-on-surface-variant shadow-sm backdrop-blur">
      <span>Phone {phone}</span>
      <button
        type="button"
        role="switch"
        aria-checked={online}
        aria-label="Online"
        onClick={() => {
          setFakeOffline(online);
          setOnline(!online);
        }}
        className={cn(
          'flex h-6 items-center gap-1.5 rounded-full px-2 transition',
          online
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-warning-container text-on-warning-container',
        )}
      >
        <span className={cn('size-1.5 rounded-full', online ? 'bg-secondary' : 'bg-warning')} />
        {online ? 'Online' : 'Offline'}
      </button>
    </div>
  );
}

import { supabaseConfig } from '@features/group-ledger/backend/createBackend';
import { FakeServerChip } from './dev/FakeServerChip';
import { Toaster } from './ui/Toaster';

export function AppOverlays({ groups }: { groups: boolean }) {
  return (
    <>
      <Toaster />
      {groups && supabaseConfig() === null && <FakeServerChip />}
    </>
  );
}

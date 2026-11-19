import { supabaseConfig } from '@features/group-ledger/backend/createBackend';
import { FakeServerChip } from './dev/FakeServerChip';
import { Toaster } from './ui/Toaster';

/**
 * What floats over every screen: the toast, and on the fake server the phone switch, which the
 * quick split leaves out because it has no groups.
 */
export function AppOverlays({ groups }: { groups: boolean }) {
  return (
    <>
      <Toaster />
      {groups && supabaseConfig() === null && <FakeServerChip />}
    </>
  );
}

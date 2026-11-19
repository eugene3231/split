import { supabaseConfig } from '@features/group-ledger/backend/createBackend';
import { FakeServerChip } from './dev/FakeServerChip';
import { Toaster } from './ui/Toaster';

/** What floats over every screen: the toast, and on the fake server the phone switch. */
export function AppOverlays() {
  return (
    <>
      <Toaster />
      {supabaseConfig() === null && <FakeServerChip />}
    </>
  );
}

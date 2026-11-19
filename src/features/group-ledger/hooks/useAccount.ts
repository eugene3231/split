import { useEffect } from 'react';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';

/** Who this phone is, and the "Keep my groups" email sign-in. Confirms the session on mount. */
export function useAccount() {
  const account = useAccountStore();
  useEffect(() => {
    void useAccountStore.getState().load();
  }, []);
  return account;
}

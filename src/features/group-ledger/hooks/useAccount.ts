import { useEffect } from 'react';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';

export function useAccount() {
  const account = useAccountStore();
  useEffect(() => {
    void useAccountStore.getState().load();
  }, []);
  return account;
}

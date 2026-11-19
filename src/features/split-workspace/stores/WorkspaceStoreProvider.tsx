import type { ReactNode } from 'react';
import {
  WorkspaceStoreContext,
  type WorkspaceStoreApi,
} from '@features/split-workspace/stores/receiptStore';

interface WorkspaceStoreProviderProps {
  store: WorkspaceStoreApi;
  children: ReactNode;
}

export function WorkspaceStoreProvider({ store, children }: WorkspaceStoreProviderProps) {
  return <WorkspaceStoreContext value={store}>{children}</WorkspaceStoreContext>;
}

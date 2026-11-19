import type { ReactElement } from 'react';
import { useRoute, type Route } from '@shared/routing';
import { FakeServerChip, Toaster } from '@features/group-ledger';
import { ActivityPage } from '@pages/ActivityPage';
import { EntryPage } from '@pages/EntryPage';
import { GroupPage } from '@pages/GroupPage';
import { HomePage } from '@pages/HomePage';
import { JoinPage } from '@pages/JoinPage';
import { NewExpensePage } from '@pages/NewExpensePage';
import { NewReceiptPage } from '@pages/NewReceiptPage';
import { ReceiptSplitterPage } from '@pages/ReceiptSplitterPage';
import { SettlePage } from '@pages/SettlePage';

function Screen({ route }: { route: Route }): ReactElement {
  switch (route.kind) {
    case 'home':
      return <HomePage />;
    case 'split':
      return <ReceiptSplitterPage />;
    case 'join':
      return <JoinPage code={route.code} />;
    case 'group':
      return <GroupPage groupId={route.groupId} />;
    case 'newExpense':
      return <NewExpensePage groupId={route.groupId} />;
    case 'newReceipt':
      return <NewReceiptPage groupId={route.groupId} />;
    case 'entry':
      return <EntryPage key={route.entryId} groupId={route.groupId} entryId={route.entryId} />;
    case 'settle':
      return <SettlePage groupId={route.groupId} />;
    case 'activity':
      return <ActivityPage groupId={route.groupId} />;
  }
}

function App(): ReactElement {
  const route = useRoute();
  return (
    <>
      <Screen route={route} />
      <Toaster />
      {route.kind !== 'split' && <FakeServerChip />}
    </>
  );
}

export default App;

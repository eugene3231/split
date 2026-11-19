import type { ReactElement } from 'react';
import { useRoute, type Route } from '@shared/routing';
import { AppOverlays } from '@features/group-ledger';
import { ActivityPage } from '@pages/ActivityPage';
import { ExpensePage } from '@pages/ExpensePage';
import { GroupPage } from '@pages/GroupPage';
import { GroupReceiptPage } from '@pages/GroupReceiptPage';
import { HomePage } from '@pages/HomePage';
import { JoinPage } from '@pages/JoinPage';
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
      return <ExpensePage groupId={route.groupId} />;
    case 'editExpense':
      return <ExpensePage groupId={route.groupId} entryId={route.entryId} />;
    case 'receipt':
      return <GroupReceiptPage groupId={route.groupId} entryId={route.entryId} />;
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
      <AppOverlays groups={route.kind !== 'split'} />
    </>
  );
}

export default App;

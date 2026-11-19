import type { ReactElement } from 'react';
import { useRoute } from '@shared/routing';
import { HomePage } from '@pages/HomePage';
import { GroupPage } from '@pages/GroupPage';
import { ReceiptSplitterPage } from '@pages/ReceiptSplitterPage';

function App(): ReactElement {
  const route = useRoute();
  switch (route.kind) {
    case 'home':
      return <HomePage />;
    case 'split':
      return <ReceiptSplitterPage />;
    case 'join':
    case 'group':
    case 'newExpense':
    case 'editExpense':
    case 'receipt':
    case 'settle':
    case 'activity':
      return <GroupPage />;
  }
}

export default App;

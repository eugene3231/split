import { ReceiptSplitterPage } from '@pages/ReceiptSplitterPage';
import { UxPrototypePage } from '@pages/UxPrototypePage';
import { readPrototypeSelection } from '@features/ux-prototypes';

function App() {
  const prototype = readPrototypeSelection(window.location.search);
  if (prototype) return <UxPrototypePage selection={prototype} />;
  return <ReceiptSplitterPage />;
}

export default App;

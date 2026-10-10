import { ReceiptSplitterPage } from '@pages/ReceiptSplitterPage';
import { UxPrototypePage } from '@pages/UxPrototypePage';
import { toPrototypeName } from '@features/ux-prototypes';

function App() {
  const prototype = toPrototypeName(new URLSearchParams(window.location.search).get('prototype'));
  if (prototype) return <UxPrototypePage name={prototype} />;
  return <ReceiptSplitterPage />;
}

export default App;

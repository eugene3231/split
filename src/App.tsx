import { useSyncExternalStore } from 'react';
import { ReceiptSplitterPage } from '@pages/ReceiptSplitterPage';
import { SettleUpPrototypePage } from '@pages/prototypes/SettleUpPrototypePage';
import { ShareLinkPrototypePage } from '@pages/prototypes/ShareLinkPrototypePage';

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function useLocationHash() {
  return useSyncExternalStore(subscribeToHash, () => window.location.hash);
}

function App() {
  const hash = useLocationHash();

  if (hash === '#/prototypes/settle-up') {
    return <SettleUpPrototypePage />;
  }
  if (hash.startsWith('#/prototypes/share')) {
    return <ShareLinkPrototypePage hash={hash} />;
  }
  return <ReceiptSplitterPage />;
}

export default App;

import { GeminiApiKeyModal } from '@pages/components/workspace/GeminiApiKeyModal';
import { Workspace } from '@pages/components/workspace/Workspace';

export function ReceiptSplitterPage() {
  return (
    <main className="min-h-screen bg-surface">
      <Workspace />
      <GeminiApiKeyModal />
    </main>
  );
}

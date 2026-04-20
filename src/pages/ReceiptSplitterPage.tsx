import { GeminiApiKeyModal, Workspace } from '@features/split-workspace';

export function ReceiptSplitterPage() {
  return (
    <main className="min-h-screen bg-surface">
      <Workspace />
      <GeminiApiKeyModal />
    </main>
  );
}

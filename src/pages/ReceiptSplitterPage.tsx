import { GeminiApiKeyModal } from '@pages/components/new/GeminiApiKeyModal'
import { NewWorkspace } from '@pages/components/new/NewWorkspace'

export function ReceiptSplitterPage() {
  return (
    <main className="min-h-screen bg-surface">
      <NewWorkspace />
      <GeminiApiKeyModal />
    </main>
  )
}

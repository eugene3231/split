import { GeminiApiKeyModal } from '../features/receipt-scanner/components/GeminiApiKeyModal'
import { NewWorkspace } from './components/new/NewWorkspace'

export function ReceiptSplitterPage() {
  return (
    <main className="min-h-screen bg-surface">
      <NewWorkspace />
      <GeminiApiKeyModal />
    </main>
  )
}

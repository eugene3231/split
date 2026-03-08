import { AdvancedWorkspace, SimpleWorkspace } from '../features/receipt-workspace'
import { GeminiApiKeyModal } from '../features/receipt-import/components/GeminiApiKeyModal'
import { ReceiptSplitterHeader } from './components/ReceiptSplitterHeader'
import { useReceiptSplitterController } from './hooks/useReceiptSplitterController'

export function ReceiptSplitterPage() {
  const controller = useReceiptSplitterController()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Subtle top glow for visual depth */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-5%,rgba(14,165,233,0.07),transparent)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl space-y-5 p-4 pb-16 sm:p-6 lg:p-8">
        <ReceiptSplitterHeader
          uxMode={controller.uxMode}
          onUxModeChange={controller.handleUxModeChange}
        />

        {controller.uxMode === 'simple' ? (
          <SimpleWorkspace />
        ) : (
          <AdvancedWorkspace />
        )}
      </div>

      <GeminiApiKeyModal />
    </main>
  )
}

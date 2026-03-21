import { AdvancedWorkspace } from '@pages/components/advanced/AdvancedWorkspace'
import { SimpleWorkspace } from '@pages/components/simple/SimpleWorkspace'
import { GeminiApiKeyModal } from '@features/receipt-scanner/components/GeminiApiKeyModal'
import { ReceiptSplitterHeader } from '@pages/components/ReceiptSplitterHeader'
import { useReceiptSplitterController } from '@pages/hooks/useReceiptSplitterController'

export function LegacyReceiptSplitterPage() {
  const controller = useReceiptSplitterController()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
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

      <footer className="border-t border-slate-800 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Eugene Chua. All rights reserved.
      </footer>
    </main>
  )
}

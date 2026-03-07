import { AdvancedWorkspace, SimpleWorkspace } from '../features/receipt-workspace'
import { ReceiptSplitterHeader } from './components/ReceiptSplitterHeader'
import { useReceiptSplitterController } from './hooks/useReceiptSplitterController'

export function ReceiptSplitterPage() {
  const controller = useReceiptSplitterController()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 sm:p-6 lg:p-8">
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
    </main>
  )
}

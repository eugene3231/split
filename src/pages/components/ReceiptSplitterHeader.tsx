type ReceiptSplitterHeaderProps = {
  uxMode: 'simple' | 'advanced'
  onUxModeChange: (nextMode: 'simple' | 'advanced') => void
}

export function ReceiptSplitterHeader({ uxMode, onUxModeChange }: ReceiptSplitterHeaderProps) {
  return (
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Split Receipt</p>
      <h1 className="text-3xl font-bold tracking-tight">Split</h1>
      <p className="w-full text-slate-300">
        Item-level splits with discounts, charges, and shareable text and image summaries.
      </p>
      <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => onUxModeChange('simple')}
          className={`rounded-md px-3 py-1.5 transition ${
            uxMode === 'simple' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Simple Mode
        </button>
        <button
          type="button"
          onClick={() => onUxModeChange('advanced')}
          className={`rounded-md px-3 py-1.5 transition ${
            uxMode === 'advanced' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Advanced Mode
        </button>
      </div>
    </header>
  )
}

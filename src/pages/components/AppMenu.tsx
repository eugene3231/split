import { useRef, useState, type ChangeEvent } from 'react'
import { useReceiptUiStore } from '../../shared/stores/receiptUiStore'
import { useReceiptWorkspaceStore } from '../../features/receipt-workspace/store/receiptWorkspaceStore'

export function AppMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportTimeoutRef = useRef<number | null>(null)

  const uxMode = useReceiptUiStore((state) => state.uxMode)
  const getExportJson = useReceiptWorkspaceStore((state) => state.getExportJson)
  const importFromJson = useReceiptWorkspaceStore((state) => state.importFromJson)
  const handleLoadSimpleMockReceipt = useReceiptWorkspaceStore((state) => state.handleLoadSimpleMockReceipt)
  const handleLoadMockReceipt = useReceiptWorkspaceStore((state) => state.handleLoadMockReceipt)

  const close = () => { setIsOpen(false); setImportError(null) }

  const handleExport = async () => {
    const json = getExportJson()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `split-${timestamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    try { await navigator.clipboard.writeText(json) } catch { /* ignore */ }
    setExported(true)
    if (exportTimeoutRef.current !== null) window.clearTimeout(exportTimeoutRef.current)
    exportTimeoutRef.current = window.setTimeout(() => setExported(false), 2500)
    close()
  }

  const handleImportClick = () => {
    setImportError(null)
    fileInputRef.current?.click()
    close()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') { setImportError('Failed to read file.'); return }
      importFromJson(reader.result)
    }
    reader.onerror = () => setImportError('Failed to read file.')
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleLoadMock = () => {
    if (uxMode === 'simple') handleLoadSimpleMockReceipt()
    else handleLoadMockReceipt()
    close()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200 active:scale-95"
      >
        <svg width="4" height="18" viewBox="0 0 4 18" fill="currentColor">
          <circle cx="2" cy="2" r="1.75" />
          <circle cx="2" cy="9" r="1.75" />
          <circle cx="2" cy="16" r="1.75" />
        </svg>
      </button>

      {isOpen ? (
        <>
          {/* Transparent backdrop to catch outside clicks */}
          <div className="fixed inset-0 z-30" aria-hidden="true" onClick={close} />

          <div
            role="menu"
            className="absolute right-0 top-12 z-40 w-52 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleImportClick}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/6 hover:text-slate-100"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import JSON
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleExport}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/6 hover:text-slate-100"
            >
              {exported ? (
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {exported ? 'Exported ✓' : 'Export JSON'}
            </button>

            <div className="mx-3 border-t border-white/8" />

            <button
              type="button"
              role="menuitem"
              onClick={handleLoadMock}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/6 hover:text-slate-100"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Load Mock Receipt
            </button>
          </div>
        </>
      ) : null}

      {importError ? (
        <p className="absolute right-0 top-14 w-52 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 shadow-lg">
          {importError}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}

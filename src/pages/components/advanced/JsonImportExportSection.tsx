import { useRef, useState } from 'react';

type JsonImportExportSectionProps = {
  onGetJson: () => string;
  onImportJson: (raw: string) => void;
};

export function JsonImportExportSection({ onGetJson, onImportJson }: JsonImportExportSectionProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const json = onGetJson();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `split-${timestamp}.json`;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    try {
      await navigator.clipboard.writeText(json);
      setIsCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
      }, 2500);
    } catch {
      // Clipboard failed — download still succeeded, no tick shown
    }
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result;
      if (typeof raw !== 'string') {
        setImportError('Failed to read file.');
        return;
      }
      onImportJson(raw);
      setImportError(null);
    };
    reader.onerror = () => {
      setImportError('Failed to read file.');
    };
    reader.readAsText(file);

    // Reset so the same file can be re-imported
    event.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleImportClick}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
        >
          Import JSON
        </button>
        <button
          type="button"
          onClick={handleExport}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
            isCopied
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
          }`}
        >
          {isCopied ? 'Exported ✓' : 'Export JSON'}
        </button>
      </div>
      {importError ? <p className="text-xs text-rose-400">{importError}</p> : null}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

import { AppMenu } from '@pages/components/AppMenu';

type ReceiptSplitterHeaderProps = {
  uxMode: 'simple' | 'advanced';
  onUxModeChange: (nextMode: 'simple' | 'advanced') => void;
};

export function ReceiptSplitterHeader({ uxMode, onUxModeChange }: ReceiptSplitterHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-500/80">
          Receipt Splitter
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">Split</h1>
        <p className="text-xs text-slate-500 sm:text-sm mb-2">
          Item-level splits with discounts, charges, and shareable summaries.
        </p>
        <div className="inline-flex rounded-lg border border-white/8 bg-slate-900 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onUxModeChange('simple')}
            className={`rounded-md px-3 py-1.5 transition-all ${
              uxMode === 'simple'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => onUxModeChange('advanced')}
            className={`rounded-md px-3 py-1.5 transition-all ${
              uxMode === 'advanced'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      <AppMenu />
    </header>
  );
}

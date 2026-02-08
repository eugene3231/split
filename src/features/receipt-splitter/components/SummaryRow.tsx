type SummaryRowProps = {
  label: string
  value: string
  emphasized?: boolean
  tone?: 'neutral' | 'ok' | 'warn'
}

export function SummaryRow({ label, value, emphasized = false, tone = 'neutral' }: SummaryRowProps) {
  const toneClass =
    tone === 'ok' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-200'

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className={`${toneClass} ${emphasized ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  )
}

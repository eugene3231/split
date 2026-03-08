export type PersonColorScheme = {
  /** Solid bg for selected/active pill state */
  bg: string
  /** Text color for use ON the solid bg */
  text: string
  /** Subtle tinted bg for card headers / unselected accents */
  lightBg: string
  /** Border accent color */
  border: string
  /** Readable accent text on dark surfaces */
  accent: string
}

const PERSON_COLORS: PersonColorScheme[] = [
  { bg: 'bg-cyan-500',    text: 'text-cyan-950',    lightBg: 'bg-cyan-500/15',    border: 'border-cyan-500/50',    accent: 'text-cyan-300' },
  { bg: 'bg-violet-500',  text: 'text-violet-950',  lightBg: 'bg-violet-500/15',  border: 'border-violet-500/50',  accent: 'text-violet-300' },
  { bg: 'bg-amber-400',   text: 'text-amber-950',   lightBg: 'bg-amber-400/15',   border: 'border-amber-400/50',   accent: 'text-amber-300' },
  { bg: 'bg-emerald-500', text: 'text-emerald-950', lightBg: 'bg-emerald-500/15', border: 'border-emerald-500/50', accent: 'text-emerald-300' },
  { bg: 'bg-rose-500',    text: 'text-rose-950',    lightBg: 'bg-rose-500/15',    border: 'border-rose-500/50',    accent: 'text-rose-300' },
  { bg: 'bg-orange-500',  text: 'text-orange-950',  lightBg: 'bg-orange-500/15',  border: 'border-orange-500/50',  accent: 'text-orange-300' },
]

export function getPersonColor(index: number): PersonColorScheme {
  return PERSON_COLORS[index % PERSON_COLORS.length]
}

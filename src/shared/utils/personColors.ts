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
  /** Hex color for avatar circle background (light theme) */
  avatarBg: string
  /** Hex color for avatar text (always white) */
  avatarText: string
}

const PERSON_COLORS: PersonColorScheme[] = [
  { bg: 'bg-emerald-300', text: 'text-emerald-950', lightBg: 'bg-emerald-300/20', border: 'border-emerald-300/50', accent: 'text-emerald-600', avatarBg: '#86d97a', avatarText: '#003d46' },
  { bg: 'bg-sky-300',     text: 'text-sky-950',     lightBg: 'bg-sky-300/20',     border: 'border-sky-300/50',     accent: 'text-sky-600',     avatarBg: '#89c8ef', avatarText: '#003d46' },
  { bg: 'bg-teal-300',    text: 'text-teal-950',    lightBg: 'bg-teal-300/20',    border: 'border-teal-300/50',    accent: 'text-teal-600',    avatarBg: '#5ecfbe', avatarText: '#003d46' },
  { bg: 'bg-violet-300',  text: 'text-violet-950',  lightBg: 'bg-violet-300/20',  border: 'border-violet-300/50',  accent: 'text-violet-600',  avatarBg: '#b4a8e8', avatarText: '#003d46' },
  { bg: 'bg-amber-200',   text: 'text-amber-950',   lightBg: 'bg-amber-200/20',   border: 'border-amber-200/50',   accent: 'text-amber-600',   avatarBg: '#f5d87a', avatarText: '#003d46' },
]

export function getPersonColor(index: number): PersonColorScheme {
  return PERSON_COLORS[index % PERSON_COLORS.length]
}

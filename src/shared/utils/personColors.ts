export type PersonColorScheme = {
  /** Solid bg for selected/active pill state */
  bg: string;
  /** Text color for use ON the solid bg */
  text: string;
  /** Subtle tinted bg for card headers / unselected accents */
  lightBg: string;
  /** Border accent color */
  border: string;
  /** Readable accent text on dark surfaces */
  accent: string;
  /** Hex color for avatar circle background (light theme) */
  avatarBg: string;
  /** Hex color for avatar text */
  avatarText: string;
};

const PERSON_COLORS: PersonColorScheme[] = [
  {
    bg: 'bg-person-1',
    text: 'text-white',
    lightBg: 'bg-person-1/15',
    border: 'border-person-1/40',
    accent: 'text-person-1',
    avatarBg: '#c54a2f',
    avatarText: '#ffffff',
  },
  {
    bg: 'bg-person-2',
    text: 'text-white',
    lightBg: 'bg-person-2/15',
    border: 'border-person-2/40',
    accent: 'text-person-2',
    avatarBg: '#2a7338',
    avatarText: '#ffffff',
  },
  {
    bg: 'bg-person-3',
    text: 'text-white',
    lightBg: 'bg-person-3/15',
    border: 'border-person-3/40',
    accent: 'text-person-3',
    avatarBg: '#b87420',
    avatarText: '#ffffff',
  },
  {
    bg: 'bg-person-4',
    text: 'text-white',
    lightBg: 'bg-person-4/15',
    border: 'border-person-4/40',
    accent: 'text-person-4',
    avatarBg: '#335598',
    avatarText: '#ffffff',
  },
  {
    bg: 'bg-person-5',
    text: 'text-white',
    lightBg: 'bg-person-5/15',
    border: 'border-person-5/40',
    accent: 'text-person-5',
    avatarBg: '#7a3daa',
    avatarText: '#ffffff',
  },
  {
    bg: 'bg-person-6',
    text: 'text-white',
    lightBg: 'bg-person-6/15',
    border: 'border-person-6/40',
    accent: 'text-person-6',
    avatarBg: '#1a7a6a',
    avatarText: '#ffffff',
  },
  {
    bg: 'bg-person-7',
    text: 'text-white',
    lightBg: 'bg-person-7/15',
    border: 'border-person-7/40',
    accent: 'text-person-7',
    avatarBg: '#b87828',
    avatarText: '#ffffff',
  },
  {
    bg: 'bg-person-8',
    text: 'text-white',
    lightBg: 'bg-person-8/15',
    border: 'border-person-8/40',
    accent: 'text-person-8',
    avatarBg: '#5040a0',
    avatarText: '#ffffff',
  },
];

export function getPersonColor(index: number): PersonColorScheme {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

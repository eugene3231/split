const PERSON_COLORS = [
  '#0f766e',
  '#c2410c',
  '#2563eb',
  '#be185d',
  '#4d7c0f',
  '#7c3aed',
  '#b45309',
  '#0e7490',
  '#b91c1c',
  '#4338ca',
] as const;

/** Avatar fill for the person at `index`; initials on it are always white. */
export function personColor(index: number): string {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

const PLATE_COLORS = ['#c8553d', '#4f7f7a', '#e09f3e', '#6d597a', '#7f8b52'];

export function plateColor(index: number): string {
  return PLATE_COLORS[index % PLATE_COLORS.length];
}

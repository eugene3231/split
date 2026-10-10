const CLAIM_COLORS = ['#6d4aff', '#ff5a5f', '#00a884', '#ff9f1c', '#1e88e5'];

export function claimColor(index: number): string {
  return CLAIM_COLORS[index % CLAIM_COLORS.length];
}

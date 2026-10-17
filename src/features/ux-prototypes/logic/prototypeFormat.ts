const MONEY = new Intl.NumberFormat('en-SG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(cents: number): string {
  return `$${MONEY.format(cents / 100)}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

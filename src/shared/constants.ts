interface CurrencyInfo {
  symbol: string;
  /** What one unit is worth in the base currency until a live rate has loaded. */
  fallbackRate: number;
  /**
   * Written without minor units even where ISO 4217 lists some, such as rupiah prices on
   * Indonesian receipts. Intl already drops them for JPY, KRW, VND and similar.
   */
  wholeUnits?: true;
}

/** Every currency a receipt can be in, in the order the picker lists them. */
export const CURRENCIES = {
  SGD: { symbol: '$', fallbackRate: 1 },
  USD: { symbol: 'US$', fallbackRate: 1.35 },
  EUR: { symbol: '€', fallbackRate: 1.48 },
  GBP: { symbol: '£', fallbackRate: 1.73 },
  THB: { symbol: '฿', fallbackRate: 0.038 },
  MYR: { symbol: 'RM', fallbackRate: 0.3 },
  JPY: { symbol: '¥', fallbackRate: 0.009 },
  KRW: { symbol: '₩', fallbackRate: 0.00099 },
  TWD: { symbol: 'NT$', fallbackRate: 0.042 },
  IDR: { symbol: 'Rp', fallbackRate: 0.000083, wholeUnits: true },
  PHP: { symbol: '₱', fallbackRate: 0.024 },
  AUD: { symbol: 'A$', fallbackRate: 0.88 },
  CNY: { symbol: '¥', fallbackRate: 0.19 },
  HKD: { symbol: 'HK$', fallbackRate: 0.17 },
  VND: { symbol: '₫', fallbackRate: 0.000053 },
  INR: { symbol: '₹', fallbackRate: 0.016 },
} satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;

// Object.keys widens to string[]; the keys of the table are exactly the codes.
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

export function currencyInfo(currency: CurrencyCode): CurrencyInfo {
  return CURRENCIES[currency];
}

/** Totals, PayNow amounts and exchange rates are all expressed in this currency. */
export const BASE_CURRENCY: CurrencyCode = 'SGD';

import type { ChargeState } from '@shared/types'

export const defaultDiscountState: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
}

export const defaultServiceChargeState: ChargeState = {
  enabled: true,
  mode: 'percent',
  amountInput: '',
  percentInput: '10',
  detectedConfidence: null,
  detectedSource: null,
}

export const defaultGstState: ChargeState = {
  enabled: true,
  mode: 'percent',
  amountInput: '',
  percentInput: '9',
  detectedConfidence: null,
  detectedSource: null,
}

export const GEMINI_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
] as const
export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0]
export const LOCAL_STORAGE_DRAFT_KEY = 'split:receipt-draft:v1'
export const LOCAL_STORAGE_OCR_SETTINGS_KEY = 'split:ocr-settings:v1'
export const LOCAL_STORAGE_UX_MODE_KEY = 'split:ux-mode:v1'
export const LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY = 'split:simple-wizard-state:v1'
export const SESSION_STORAGE_GEMINI_API_KEY = 'split:gemini-api-key:session'
export const LOCAL_STORAGE_EXCHANGE_RATES_KEY = 'split:exchange-rates:v1'

export const BASE_CURRENCY = 'SGD'

export const SUPPORTED_CURRENCIES = [
  'SGD', 'USD', 'EUR', 'GBP', 'THB', 'MYR', 'JPY', 'KRW',
  'TWD', 'IDR', 'PHP', 'AUD', 'CNY', 'HKD', 'VND', 'INR',
] as const

export const CURRENCY_SYMBOLS: Record<string, string> = {
  SGD: '$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
  THB: '฿',
  MYR: 'RM',
  JPY: '¥',
  KRW: '₩',
  TWD: 'NT$',
  IDR: 'Rp',
  PHP: '₱',
  AUD: 'A$',
  CNY: '¥',
  HKD: 'HK$',
  VND: '₫',
  INR: '₹',
}

// Approximate rates: 1 unit of foreign currency = X SGD
// Used as offline fallback when the exchange rate API is unavailable
export const FALLBACK_RATES_TO_SGD: Record<string, number> = {
  SGD: 1,
  USD: 1.35,
  EUR: 1.48,
  GBP: 1.73,
  THB: 0.038,
  MYR: 0.30,
  JPY: 0.0090,
  KRW: 0.00099,
  TWD: 0.042,
  IDR: 0.000083,
  PHP: 0.024,
  AUD: 0.88,
  CNY: 0.19,
  HKD: 0.17,
  VND: 0.000053,
  INR: 0.016,
}

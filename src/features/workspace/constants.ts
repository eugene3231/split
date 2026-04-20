import type { ChargeState } from '@shared/types';

export const defaultDiscountState: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

export const defaultServiceChargeState: ChargeState = {
  enabled: true,
  mode: 'percent',
  amountInput: '',
  percentInput: '10',
  detectedConfidence: null,
  detectedSource: null,
};

export const defaultGstState: ChargeState = {
  enabled: true,
  mode: 'percent',
  amountInput: '',
  percentInput: '9',
  detectedConfidence: null,
  detectedSource: null,
};

export const SUPPORTED_CURRENCIES = [
  'SGD',
  'USD',
  'EUR',
  'GBP',
  'THB',
  'MYR',
  'JPY',
  'KRW',
  'TWD',
  'IDR',
  'PHP',
  'AUD',
  'CNY',
  'HKD',
  'VND',
  'INR',
] as const;

export const LOCAL_STORAGE_DRAFT_KEY = 'split:receipt-draft:v1';
export const LOCAL_STORAGE_OCR_SETTINGS_KEY = 'split:ocr-settings:v1';
export const LOCAL_STORAGE_WIZARD_STATE_KEY = 'split:simple-wizard-state:v1';
export const SESSION_STORAGE_GEMINI_API_KEY = 'split:gemini-api-key:session';
export const LOCAL_STORAGE_EXCHANGE_RATES_KEY = 'split:exchange-rates:v1';

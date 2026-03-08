import type { ChargeState } from './types'

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

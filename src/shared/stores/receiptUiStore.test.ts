import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GEMINI_MODEL,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
} from '../constants'
import { useReceiptStore } from './receiptStore'

const FIRST_LOADING_MESSAGE = 'Asking Gemini to decipher cryptic cashier handwriting...'
const SECOND_LOADING_MESSAGE = 'Negotiating with suspiciously smudged totals...'

function resetStore() {
  useReceiptStore.setState({
    uxMode: 'simple',
    peopleInput: '',
    geminiApiKeyInput: '',
    rememberGeminiApiKey: false,
    geminiModel: DEFAULT_GEMINI_MODEL,
    isScanning: false,
    scanStatus: '',
    scanError: null,
    scanWarnings: [],
    loadingMessage: '',
    loadingMessageIndex: 0,
  })
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('receiptUiStore', () => {
  it('startScan sets loading baseline and randomized loading message', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    useReceiptStore.getState().startScan()
    const state = useReceiptStore.getState()

    expect(state.isScanning).toBe(true)
    expect(state.scanStatus).toBe('Preparing Gemini request...')
    expect(state.scanError).toBeNull()
    expect(state.scanWarnings).toEqual([])
    expect(state.loadingMessage).toBe(FIRST_LOADING_MESSAGE)
    expect(state.loadingMessageIndex).toBe(0)
  })

  it('advanceLoadingMessage picks a different random message', () => {
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0)
    randomSpy.mockReturnValueOnce(0)

    const actions = useReceiptStore.getState()
    actions.startScan()
    const firstState = useReceiptStore.getState()

    actions.advanceLoadingMessage()
    const state = useReceiptStore.getState()

    expect(state.loadingMessageIndex).toBe(1)
    expect(state.loadingMessage).toBe(SECOND_LOADING_MESSAGE)
    expect(state.loadingMessage).not.toBe(firstState.loadingMessage)
  })

  it('finishScan clears active loading state', () => {
    const actions = useReceiptStore.getState()
    actions.startScan()
    actions.setScanError('network issue')
    actions.setScanWarnings(['retry'])

    actions.finishScan()
    const state = useReceiptStore.getState()
    expect(state.isScanning).toBe(false)
    expect(state.scanStatus).toBe('')
    expect(state.loadingMessage).toBe('')
    expect(state.loadingMessageIndex).toBe(0)
    expect(state.scanError).toBe('network issue')
    expect(state.scanWarnings).toEqual(['retry'])
  })

  it('clearScanFeedback clears scan feedback only', () => {
    useReceiptStore.setState({
      peopleInput: 'Alice',
      geminiApiKeyInput: 'abc',
      rememberGeminiApiKey: true,
      geminiModel: 'gemini-2.5-flash',
      isScanning: true,
      scanStatus: 'Calling Gemini...',
      scanError: 'boom',
      scanWarnings: ['low confidence'],
      loadingMessage: 'Working...',
      loadingMessageIndex: 3,
    })

    useReceiptStore.getState().clearScanFeedback()
    const state = useReceiptStore.getState()

    expect(state.scanStatus).toBe('')
    expect(state.scanError).toBeNull()
    expect(state.scanWarnings).toEqual([])
    expect(state.loadingMessage).toBe('')
    expect(state.loadingMessageIndex).toBe(0)

    expect(state.peopleInput).toBe('Alice')
    expect(state.geminiApiKeyInput).toBe('abc')
    expect(state.rememberGeminiApiKey).toBe(true)
    expect(state.geminiModel).toBe('gemini-2.5-flash')
    expect(state.isScanning).toBe(true)
  })

  it('setScanStatus/setScanError/setScanWarnings support value and updater forms', () => {
    const actions = useReceiptStore.getState()

    actions.setScanStatus('Encoding receipt...')
    actions.setScanStatus((current) => `${current} done`)

    actions.setScanError('first')
    actions.setScanError((current) => (current ? `${current}!` : current))

    actions.setScanWarnings(['a'])
    actions.setScanWarnings((current) => [...current, 'b'])

    const state = useReceiptStore.getState()
    expect(state.scanStatus).toBe('Encoding receipt... done')
    expect(state.scanError).toBe('first!')
    expect(state.scanWarnings).toEqual(['a', 'b'])
  })

  it('setUxMode updates mode state', () => {
    const actions = useReceiptStore.getState()
    actions.setUxMode('advanced')

    expect(useReceiptStore.getState().uxMode).toBe('advanced')
  })

  it('persists gemini model changes through the store action', () => {
    useReceiptStore.getState().setGeminiModel('gemini-2.5-flash')

    expect(useReceiptStore.getState().geminiModel).toBe('gemini-2.5-flash')
    expect(window.localStorage.getItem(LOCAL_STORAGE_OCR_SETTINGS_KEY)).toContain(
      '"geminiModel":"gemini-2.5-flash"',
    )
  })

  it('persists and clears the session gemini api key through store actions', () => {
    const actions = useReceiptStore.getState()

    actions.setRememberGeminiApiKey(true)
    actions.setGeminiApiKeyInput('session-key')
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBe('session-key')

    actions.setGeminiApiKeyInput('')
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBeNull()

    actions.setGeminiApiKeyInput('session-key')
    actions.setRememberGeminiApiKey(false)
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBeNull()
  })
})

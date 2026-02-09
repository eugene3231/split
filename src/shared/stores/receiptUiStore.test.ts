import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GEMINI_MODEL } from '../constants'
import { useReceiptUiStore } from './receiptUiStore'

const FIRST_LOADING_MESSAGE = 'Asking Gemini to decipher cryptic cashier handwriting...'
const SECOND_LOADING_MESSAGE = 'Negotiating with suspiciously smudged totals...'

function resetStore() {
  useReceiptUiStore.setState({
    peopleInput: '',
    geminiApiKeyInput: '',
    rememberGeminiApiKey: false,
    geminiModel: DEFAULT_GEMINI_MODEL,
    receiptFile: null,
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

    useReceiptUiStore.getState().startScan()
    const state = useReceiptUiStore.getState()

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

    const actions = useReceiptUiStore.getState()
    actions.startScan()
    const firstState = useReceiptUiStore.getState()

    actions.advanceLoadingMessage()
    const state = useReceiptUiStore.getState()

    expect(state.loadingMessageIndex).toBe(1)
    expect(state.loadingMessage).toBe(SECOND_LOADING_MESSAGE)
    expect(state.loadingMessage).not.toBe(firstState.loadingMessage)
  })

  it('finishScan clears active loading state', () => {
    const actions = useReceiptUiStore.getState()
    actions.startScan()
    actions.setScanError('network issue')
    actions.setScanWarnings(['retry'])

    actions.finishScan()
    const state = useReceiptUiStore.getState()
    expect(state.isScanning).toBe(false)
    expect(state.scanStatus).toBe('')
    expect(state.loadingMessage).toBe('')
    expect(state.loadingMessageIndex).toBe(0)
    expect(state.scanError).toBe('network issue')
    expect(state.scanWarnings).toEqual(['retry'])
  })

  it('clearScanFeedback clears scan feedback only', () => {
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })
    useReceiptUiStore.setState({
      peopleInput: 'Alice',
      geminiApiKeyInput: 'abc',
      rememberGeminiApiKey: true,
      geminiModel: 'gemini-2.5-flash',
      receiptFile: file,
      isScanning: true,
      scanStatus: 'Calling Gemini...',
      scanError: 'boom',
      scanWarnings: ['low confidence'],
      loadingMessage: 'Working...',
      loadingMessageIndex: 3,
    })

    useReceiptUiStore.getState().clearScanFeedback()
    const state = useReceiptUiStore.getState()

    expect(state.scanStatus).toBe('')
    expect(state.scanError).toBeNull()
    expect(state.scanWarnings).toEqual([])
    expect(state.loadingMessage).toBe('')
    expect(state.loadingMessageIndex).toBe(0)

    expect(state.peopleInput).toBe('Alice')
    expect(state.geminiApiKeyInput).toBe('abc')
    expect(state.rememberGeminiApiKey).toBe(true)
    expect(state.geminiModel).toBe('gemini-2.5-flash')
    expect(state.receiptFile).toBe(file)
    expect(state.isScanning).toBe(true)
  })

  it('setScanStatus/setScanError/setScanWarnings support value and updater forms', () => {
    const actions = useReceiptUiStore.getState()

    actions.setScanStatus('Encoding receipt...')
    actions.setScanStatus((current) => `${current} done`)

    actions.setScanError('first')
    actions.setScanError((current) => (current ? `${current}!` : current))

    actions.setScanWarnings(['a'])
    actions.setScanWarnings((current) => [...current, 'b'])

    const state = useReceiptUiStore.getState()
    expect(state.scanStatus).toBe('Encoding receipt... done')
    expect(state.scanError).toBe('first!')
    expect(state.scanWarnings).toEqual(['a', 'b'])
  })
})

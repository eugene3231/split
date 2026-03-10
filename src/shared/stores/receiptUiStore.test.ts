import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GEMINI_MODEL,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
} from '../constants'
import { useReceiptStore } from './receiptStore'

const FIRST_LOADING_MESSAGE = 'Asking Gemini to decipher cryptic cashier handwriting...'
const SECOND_LOADING_MESSAGE = 'Negotiating with suspiciously smudged totals...'

const TEST_RECEIPT_ID = 'test-receipt-1'

function resetStore() {
  useReceiptStore.setState({
    uxMode: 'simple',
    peopleInput: '',
    geminiApiKeyInput: '',
    rememberGeminiApiKey: false,
    geminiModel: DEFAULT_GEMINI_MODEL,
    scanStateByReceipt: {},
    initialized: false,
    people: [],
    receipts: [],
    activeReceiptId: '',
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

    useReceiptStore.getState().startScan(TEST_RECEIPT_ID)
    const scanState = useReceiptStore.getState().scanStateByReceipt[TEST_RECEIPT_ID]

    expect(scanState.isScanning).toBe(true)
    expect(scanState.scanStatus).toBe('Preparing Gemini request...')
    expect(scanState.scanError).toBeNull()
    expect(scanState.scanWarnings).toEqual([])
    expect(scanState.loadingMessage).toBe(FIRST_LOADING_MESSAGE)
    expect(scanState.loadingMessageIndex).toBe(0)
  })

  it('advanceLoadingMessage picks a different random message', () => {
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0)
    randomSpy.mockReturnValueOnce(0)

    const actions = useReceiptStore.getState()
    actions.startScan(TEST_RECEIPT_ID)
    const firstScanState = useReceiptStore.getState().scanStateByReceipt[TEST_RECEIPT_ID]

    actions.advanceLoadingMessage()
    const scanState = useReceiptStore.getState().scanStateByReceipt[TEST_RECEIPT_ID]

    expect(scanState.loadingMessageIndex).toBe(1)
    expect(scanState.loadingMessage).toBe(SECOND_LOADING_MESSAGE)
    expect(scanState.loadingMessage).not.toBe(firstScanState.loadingMessage)
  })

  it('finishScan clears active loading state', () => {
    const actions = useReceiptStore.getState()
    actions.startScan(TEST_RECEIPT_ID)
    actions.setScanError(TEST_RECEIPT_ID, 'network issue')
    actions.setScanWarnings(TEST_RECEIPT_ID, ['retry'])

    actions.finishScan(TEST_RECEIPT_ID)
    const scanState = useReceiptStore.getState().scanStateByReceipt[TEST_RECEIPT_ID]
    expect(scanState.isScanning).toBe(false)
    expect(scanState.scanStatus).toBe('')
    expect(scanState.loadingMessage).toBe('')
    expect(scanState.loadingMessageIndex).toBe(0)
    expect(scanState.scanError).toBe('network issue')
    expect(scanState.scanWarnings).toEqual(['retry'])
  })

  it('clearScanFeedback clears scan feedback only', () => {
    useReceiptStore.setState({
      peopleInput: 'Alice',
      geminiApiKeyInput: 'abc',
      rememberGeminiApiKey: true,
      geminiModel: 'gemini-2.5-flash',
      scanStateByReceipt: {
        [TEST_RECEIPT_ID]: {
          isScanning: true,
          scanStatus: 'Calling Gemini...',
          scanError: 'boom',
          scanWarnings: ['low confidence'],
          loadingMessage: 'Working...',
          loadingMessageIndex: 3,
        },
      },
    })

    useReceiptStore.getState().clearScanFeedback(TEST_RECEIPT_ID)
    const state = useReceiptStore.getState()
    const scanState = state.scanStateByReceipt[TEST_RECEIPT_ID]

    expect(scanState.scanStatus).toBe('')
    expect(scanState.scanError).toBeNull()
    expect(scanState.scanWarnings).toEqual([])
    expect(scanState.loadingMessage).toBe('')
    expect(scanState.loadingMessageIndex).toBe(0)

    expect(scanState.isScanning).toBe(true)
    expect(state.peopleInput).toBe('Alice')
    expect(state.geminiApiKeyInput).toBe('abc')
    expect(state.rememberGeminiApiKey).toBe(true)
    expect(state.geminiModel).toBe('gemini-2.5-flash')
  })

  it('setScanStatus/setScanError/setScanWarnings support value and updater forms', () => {
    const actions = useReceiptStore.getState()

    actions.setScanStatus(TEST_RECEIPT_ID, 'Encoding receipt...')
    actions.setScanStatus(TEST_RECEIPT_ID, (current) => `${current} done`)

    actions.setScanError(TEST_RECEIPT_ID, 'first')
    actions.setScanError(TEST_RECEIPT_ID, (current) => (current ? `${current}!` : current))

    actions.setScanWarnings(TEST_RECEIPT_ID, ['a'])
    actions.setScanWarnings(TEST_RECEIPT_ID, (current) => [...current, 'b'])

    const scanState = useReceiptStore.getState().scanStateByReceipt[TEST_RECEIPT_ID]
    expect(scanState.scanStatus).toBe('Encoding receipt... done')
    expect(scanState.scanError).toBe('first!')
    expect(scanState.scanWarnings).toEqual(['a', 'b'])
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

describe('receipt management', () => {
  it('addReceipt creates a new receipt and activates it', () => {
    useReceiptStore.getState().initialize('simple')
    expect(useReceiptStore.getState().receipts).toHaveLength(1)

    useReceiptStore.getState().addReceipt()
    const state = useReceiptStore.getState()

    expect(state.receipts).toHaveLength(2)
    expect(state.activeReceiptId).toBe(state.receipts[1].id)
    expect(state.receipts[1].name).toBe('Receipt 2')
  })

  it('removeReceipt removes a receipt and updates activeReceiptId', () => {
    useReceiptStore.getState().initialize('simple')
    useReceiptStore.getState().addReceipt()

    const stateBefore = useReceiptStore.getState()
    const firstId = stateBefore.receipts[0].id
    const secondId = stateBefore.receipts[1].id
    expect(stateBefore.activeReceiptId).toBe(secondId)

    useReceiptStore.getState().removeReceipt(secondId)
    const state = useReceiptStore.getState()

    expect(state.receipts).toHaveLength(1)
    expect(state.activeReceiptId).toBe(firstId)
  })

  it('removeReceipt does not remove the last remaining receipt', () => {
    useReceiptStore.getState().initialize('simple')
    const receiptId = useReceiptStore.getState().receipts[0].id

    useReceiptStore.getState().removeReceipt(receiptId)

    expect(useReceiptStore.getState().receipts).toHaveLength(1)
  })

  it('setActiveReceiptId switches the active receipt', () => {
    useReceiptStore.getState().initialize('simple')
    useReceiptStore.getState().addReceipt()

    const firstId = useReceiptStore.getState().receipts[0].id
    useReceiptStore.getState().setActiveReceiptId(firstId)

    expect(useReceiptStore.getState().activeReceiptId).toBe(firstId)
  })

  it('setActiveReceiptId ignores unknown receipt ids', () => {
    useReceiptStore.getState().initialize('simple')
    const currentId = useReceiptStore.getState().activeReceiptId

    useReceiptStore.getState().setActiveReceiptId('nonexistent-id')

    expect(useReceiptStore.getState().activeReceiptId).toBe(currentId)
  })

  it('renameReceipt updates the receipt name', () => {
    useReceiptStore.getState().initialize('simple')
    const receiptId = useReceiptStore.getState().receipts[0].id

    useReceiptStore.getState().renameReceipt(receiptId, 'Dinner at Mario')
    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)

    expect(receipt?.name).toBe('Dinner at Mario')
  })

  it('renameReceipt ignores blank names', () => {
    useReceiptStore.getState().initialize('simple')
    const receiptId = useReceiptStore.getState().receipts[0].id
    const originalName = useReceiptStore.getState().receipts[0].name

    useReceiptStore.getState().renameReceipt(receiptId, '   ')
    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)

    expect(receipt?.name).toBe(originalName)
  })
})

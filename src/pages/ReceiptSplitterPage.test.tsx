import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GEMINI_MODEL } from '../shared/constants'
import { useReceiptUiStore } from '../shared/stores/receiptUiStore'

const { generateFinalSplitImageMock } = vi.hoisted(() => ({
  generateFinalSplitImageMock: vi.fn(),
}))

vi.mock('../features/split-export/api/finalSplitImage', () => ({
  generateFinalSplitImage: generateFinalSplitImageMock,
}))

import { ReceiptSplitterPage } from './ReceiptSplitterPage'

function resetUiStore() {
  useReceiptUiStore.setState({
    uxMode: 'advanced',
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

const disabledChargeState = {
  enabled: false,
  mode: 'amount',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
}

function seedDraft(overrides: {
  discount?: object
  serviceCharge?: object
  gst?: object
  receiptTotalInput?: string
  people?: object[]
  items?: object[]
}) {
  window.localStorage.setItem(
    'split:receipt-draft:v1',
    JSON.stringify({
      version: 1,
      people: overrides.people ?? [{ id: 'p1', name: 'Alice' }],
      items: overrides.items ?? [
        {
          id: 'i1',
          name: 'Pizza',
          amountInput: '10.00',
          discountPercentInput: '',
          assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
        },
      ],
      discount: overrides.discount ?? disabledChargeState,
      serviceCharge: overrides.serviceCharge ?? disabledChargeState,
      gst: overrides.gst ?? disabledChargeState,
      receiptTotalInput: overrides.receiptTotalInput ?? '',
      finalSplit: {
        subtotalCents: 0,
        serviceChargeCents: 0,
        gstCents: 0,
        grandTotalCents: 0,
        totalByPersonCents: {},
      },
      savedAt: '2026-03-08T00:00:00.000Z',
    }),
  )
}

function seedSimpleDraftWithSingleAssignment() {
  window.localStorage.setItem(
    'split:receipt-draft:v1',
    JSON.stringify({
      version: 1,
      people: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Ben' },
      ],
      items: [
        {
          id: 'i1',
          name: 'Chicken Rice',
          amountInput: '10.00',
          discountPercentInput: '',
          assignment: {
            mode: 'single',
            personId: 'p1',
            personIds: ['p1', 'p2'],
          },
        },
      ],
      serviceCharge: {
        enabled: true,
        mode: 'percent',
        amountInput: '',
        percentInput: '10',
        detectedConfidence: null,
        detectedSource: null,
      },
      gst: {
        enabled: true,
        mode: 'percent',
        amountInput: '',
        percentInput: '9',
        detectedConfidence: null,
        detectedSource: null,
      },
      receiptTotalInput: '11.90',
      finalSplit: {
        subtotalCents: 1000,
        serviceChargeCents: 100,
        gstCents: 90,
        grandTotalCents: 1190,
        totalByPersonCents: {
          p1: 1190,
          p2: 0,
        },
      },
      savedAt: '2026-03-05T00:00:00.000Z',
    }),
  )
}

function addPeople(raw: string) {
  fireEvent.change(screen.getByLabelText(/People \(type names, separated by comma\)/i), {
    target: { value: raw },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

function getAssigneeSelect(): HTMLSelectElement {
  const select = screen
    .getAllByRole('combobox')
    .find((element) =>
      Array.from((element as HTMLSelectElement).options).some(
        (option) => option.textContent === 'Select person',
      ),
    )

  if (!select) {
    throw new Error('Assignee select not found')
  }

  return select as HTMLSelectElement
}

beforeEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetUiStore()
  generateFinalSplitImageMock.mockReset()
  generateFinalSplitImageMock.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  })
})

describe('ReceiptSplitterPage advanced mode integration', () => {
  it('adds people from input and ignores duplicates case-insensitively', () => {
    render(<ReceiptSplitterPage />)

    addPeople('Alice, Ben')
    expect(screen.getAllByRole('button', { name: 'Alice ×' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Ben ×' })).toHaveLength(1)

    addPeople('alice, Bob')
    expect(screen.getAllByRole('button', { name: 'Alice ×' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Bob ×' })).toHaveLength(1)
  })

  it('supports add/remove item with minimum-one-item guard', () => {
    render(<ReceiptSplitterPage />)
    expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '+ Add Item' }))
    expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(1)
  })

  it('loads mock receipt into items, detected charges, warnings, and receipt total', () => {
    const { container } = render(<ReceiptSplitterPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Load Mock Receipt' }))

    expect(screen.getByDisplayValue('Chicken Rice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Iced Lemon Tea')).toBeInTheDocument()
    expect(screen.getByDisplayValue('47.48')).toBeInTheDocument()
    expect(container.querySelectorAll('.text-amber-300').length).toBeGreaterThan(0)
  })

  it('shows validation error when scan is clicked without API key', () => {
    const { container } = render(<ReceiptSplitterPage />)
    const fileInput = container.querySelector('[data-testid="receipt-file-input"]')
    expect(fileInput).not.toBeNull()

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Scan Receipt' }))

    expect(container.querySelector('.text-rose-400')).not.toBeNull()
  })

  it('re-sanitizes item assignments when people list changes', async () => {
    render(<ReceiptSplitterPage />)
    addPeople('Alice, Bob')

    const assigneeSelect = getAssigneeSelect()
    const bobOption = Array.from(assigneeSelect.options).find((option) => option.textContent === 'Bob')
    expect(bobOption).toBeDefined()

    fireEvent.change(assigneeSelect, { target: { value: bobOption?.value } })
    expect(assigneeSelect.selectedOptions[0].textContent).toBe('Bob')

    fireEvent.click(screen.getByRole('button', { name: 'Bob ×' }))
    await waitFor(() => {
      expect(assigneeSelect.selectedOptions[0].textContent).toBe('Alice')
    })
  })

  it('updates reconciliation row when receipt total changes', () => {
    render(<ReceiptSplitterPage />)
    addPeople('Alice')

    fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '10.00' } })
    fireEvent.change(screen.getByLabelText(/Receipt Total \(optional\)/i), {
      target: { value: '11.99' },
    })

    expect(screen.queryByText('$0.01')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Receipt Total \(optional\)/i), {
      target: { value: '12.00' },
    })
    expect(screen.getByText('$0.01')).toBeInTheDocument()
  })

  it('downloads the share image with the selected export options', async () => {
    render(<ReceiptSplitterPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Download Image' }))

    await waitFor(() => {
      expect(generateFinalSplitImageMock).toHaveBeenCalledTimes(1)
    })

    expect(generateFinalSplitImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includeLineItems: true,
        includeItemDetails: true,
      }),
    )
  })

  it('falls back from Share Split to copy summary and download image when native share is unavailable', async () => {
    render(<ReceiptSplitterPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Share Split' }))

    await waitFor(() => {
      expect(generateFinalSplitImageMock).toHaveBeenCalledTimes(1)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Split total: $0.00')
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    })
  })

  it('does not overwrite localStorage with empty state during Strict Mode double-invocation on initial mount', async () => {
    // Regression: useLayoutEffect + reset() cleanup caused useDraftPersistence to
    // save empty state between Strict Mode's unmount and remount phases, wiping
    // any data that was already in localStorage before the component mounted.
    seedSimpleDraftWithSingleAssignment()

    render(
      <StrictMode>
        <ReceiptSplitterPage />
      </StrictMode>,
    )

    // Wait for the component to fully initialize and settle
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Alice ×' })).toHaveLength(1)
    })

    const saved = window.localStorage.getItem('split:receipt-draft:v1')
    expect(saved).not.toBeNull()
    const parsed = JSON.parse(saved!)
    expect(parsed.people).toHaveLength(2)
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0].name).toBe('Chicken Rice')
  })

  it('restores advanced single-person assignments after refresh', async () => {
    const { unmount } = render(<ReceiptSplitterPage />)
    addPeople('Alice, Bob')

    const assigneeSelect = getAssigneeSelect()
    const bobOption = Array.from(assigneeSelect.options).find((option) => option.textContent === 'Bob')
    expect(bobOption).toBeDefined()

    fireEvent.change(assigneeSelect, { target: { value: bobOption?.value } })

    await waitFor(() => {
      const savedDraft = window.localStorage.getItem('split:receipt-draft:v1')
      expect(savedDraft).toContain(`"personId":"${bobOption?.value}"`)
    })

    unmount()
    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(getAssigneeSelect().selectedOptions[0].textContent).toBe('Bob')
    })
  })
})

describe('ReceiptSplitterPage simple wizard integration', () => {
  it('blocks progression until each simple wizard step is valid', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    render(<ReceiptSplitterPage />)

    const continueToReceiptButton = screen.getByTestId('wizard-continue-btn')
    expect(continueToReceiptButton).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(continueToReceiptButton).not.toBeDisabled()

    fireEvent.click(continueToReceiptButton)
    expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Load Mock Receipt/i }))
    expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled()
  })

  it('renders grouped 4-step wizard header and progresses across grouped steps', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    seedSimpleDraftWithSingleAssignment()

    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 1 of 4/i)
    })

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 2 of 4/i)

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 3 of 4/i)
  })

  it('defaults simple assignment to all selected and supports review/edit before final', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    seedSimpleDraftWithSingleAssignment()

    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))

    const aliceBtn = screen.getByRole('button', { name: 'Alice', pressed: true })
    const benBtn = screen.getByRole('button', { name: 'Ben', pressed: true })

    expect(aliceBtn).toHaveAttribute('aria-pressed', 'true')
    expect(benBtn).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(benBtn)
    expect(screen.getByRole('button', { name: 'Ben', pressed: false })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByTestId('wizard-edit-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-edit-btn'))
    expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))

    expect(screen.getByRole('button', { name: 'Share Split' })).toBeInTheDocument()
    expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 4 of 4/i)
  })

  it('supports back navigation across receipt, assign, review, and final steps', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    seedSimpleDraftWithSingleAssignment()

    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-back-btn'))
    expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByTestId('wizard-edit-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-back-btn'))
    expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByRole('button', { name: 'Share Split' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-back-btn'))
    expect(screen.getByTestId('wizard-edit-btn')).toBeInTheDocument()
  })

  it('loads the simple mode mock receipt payload from receipt step', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    render(<ReceiptSplitterPage />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Load Mock Receipt/i }))

    expect(screen.getByDisplayValue('Genki Forest')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Mala Baby Lobster')).toBeInTheDocument()
    expect(screen.getByDisplayValue('166.98')).toBeInTheDocument()
    const warningBadges = document.querySelectorAll('.text-amber-300')
    expect(warningBadges.length).toBeGreaterThan(0)
  })

  it('supports select all and select none shortcuts in simple item chooser', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    seedSimpleDraftWithSingleAssignment()

    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))

    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(screen.getByRole('button', { name: 'Alice', pressed: false })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Ben', pressed: false })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByRole('button', { name: 'Alice', pressed: true })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ben', pressed: true })).toHaveAttribute('aria-pressed', 'true')
  })

  it('returns to the people step and blocks progression when everyone is removed', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    seedSimpleDraftWithSingleAssignment()

    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-back-btn'))
    fireEvent.click(screen.getByTestId('wizard-back-btn'))
    fireEvent.click(screen.getByTestId('wizard-back-btn'))
    fireEvent.click(screen.getByTestId('wizard-back-btn'))

    fireEvent.click(screen.getByRole('button', { name: 'Alice ×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ben ×' }))

    expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled()
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
  })

  it('falls back from final to items when assignments become incomplete', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    seedSimpleDraftWithSingleAssignment()

    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    expect(screen.getByRole('button', { name: 'Share Split' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wizard-back-btn'))
    fireEvent.click(screen.getByTestId('wizard-edit-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Alice', pressed: false })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Ben', pressed: false })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Share Split' })).not.toBeInTheDocument()
  })

  it('restores simple item assignments after refresh', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple' })
    seedSimpleDraftWithSingleAssignment()

    const { unmount } = render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('wizard-continue-btn'))
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))

    const benBtn = screen.getByRole('button', { name: 'Ben', pressed: true })
    fireEvent.click(benBtn)
    expect(screen.getByRole('button', { name: 'Ben', pressed: false })).toHaveAttribute('aria-pressed', 'false')

    await waitFor(() => {
      const savedDraft = window.localStorage.getItem('split:receipt-draft:v1')
      expect(savedDraft).toContain('"personIds":["p1"]')
    })

    unmount()
    render(<ReceiptSplitterPage />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-continue-btn')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Alice', pressed: true })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ben', pressed: false })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Apply-discount-to-reconcile button', () => {
  it('appears in advanced mode when computed total exceeds receipt total', () => {
    // $10 item, no service/GST → grand total $10.00; receipt total $8.00 → reconciliation −$2.00
    seedDraft({ receiptTotalInput: '8.00' })
    render(<ReceiptSplitterPage />)
    expect(screen.getByTestId('apply-discount-reconcile-btn')).toBeInTheDocument()
  })

  it('does not appear when receipt total matches grand total', () => {
    seedDraft({ receiptTotalInput: '10.00' })
    render(<ReceiptSplitterPage />)
    expect(screen.queryByTestId('apply-discount-reconcile-btn')).not.toBeInTheDocument()
  })

  it('does not appear when receipt total is not set', () => {
    seedDraft({ receiptTotalInput: '' })
    render(<ReceiptSplitterPage />)
    expect(screen.queryByTestId('apply-discount-reconcile-btn')).not.toBeInTheDocument()
  })

  it('clicking it applies a whole-bill discount that zeroes the receipt difference', () => {
    seedDraft({ receiptTotalInput: '8.00' })
    render(<ReceiptSplitterPage />)

    fireEvent.click(screen.getByTestId('apply-discount-reconcile-btn'))

    // Reconciliation is now 0 → button disappears
    expect(screen.queryByTestId('apply-discount-reconcile-btn')).not.toBeInTheDocument()
  })

  it('appears on the simple wizard receipt step when computed total exceeds receipt total', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple', geminiApiKeyInput: 'test-key' })
    seedDraft({
      items: [
        {
          id: 'i1',
          name: 'Pizza',
          amountInput: '10.00',
          discountPercentInput: '',
          assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
        },
      ],
      receiptTotalInput: '8.00',
    })

    render(<ReceiptSplitterPage />)
    await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))

    expect(screen.getByTestId('apply-discount-reconcile-btn')).toBeInTheDocument()
  })
})

describe('Global whole-bill discount indicator on items', () => {
  it('shows a badge on each line item in advanced mode when percent discount is enabled', () => {
    seedDraft({
      discount: {
        enabled: true,
        mode: 'percent',
        amountInput: '',
        percentInput: '15',
        detectedConfidence: null,
        detectedSource: null,
      },
    })
    render(<ReceiptSplitterPage />)
    expect(screen.getByTestId('global-discount-badge')).toBeInTheDocument()
  })

  it('shows a badge on each line item in advanced mode when amount discount is enabled', () => {
    seedDraft({
      discount: {
        enabled: true,
        mode: 'amount',
        amountInput: '2.00',
        percentInput: '',
        detectedConfidence: null,
        detectedSource: null,
      },
    })
    render(<ReceiptSplitterPage />)
    expect(screen.getByTestId('global-discount-badge')).toBeInTheDocument()
  })

  it('does not show a badge when discount is disabled', () => {
    seedDraft({ discount: disabledChargeState })
    render(<ReceiptSplitterPage />)
    expect(screen.queryByTestId('global-discount-badge')).not.toBeInTheDocument()
  })

  it('shows the badge on items in the simple wizard receipt step when discount is enabled', async () => {
    useReceiptUiStore.setState({ uxMode: 'simple', geminiApiKeyInput: 'test-key' })
    seedDraft({
      items: [
        {
          id: 'i1',
          name: 'Pizza',
          amountInput: '10.00',
          discountPercentInput: '',
          assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
        },
      ],
      discount: {
        enabled: true,
        mode: 'percent',
        amountInput: '',
        percentInput: '10',
        detectedConfidence: null,
        detectedSource: null,
      },
    })

    render(<ReceiptSplitterPage />)
    await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('wizard-continue-btn'))

    expect(screen.getByTestId('global-discount-badge')).toBeInTheDocument()
  })
})

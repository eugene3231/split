import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
})

describe('ReceiptSplitterPage integration', () => {
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
    render(<ReceiptSplitterPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Load Mock Receipt' }))

    expect(screen.getByDisplayValue('Chicken Rice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Iced Lemon Tea')).toBeInTheDocument()
    expect(screen.getByDisplayValue('47.48')).toBeInTheDocument()
    expect(screen.getByText('Loaded local mock receipt data.')).toBeInTheDocument()
    expect(screen.getAllByText(/Gemini detected via mock/i).length).toBeGreaterThan(0)
  })

  it('shows validation error when scan is clicked without API key', () => {
    const { container } = render(<ReceiptSplitterPage />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).not.toBeNull()

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Scan Receipt' }))

    expect(screen.getByText('Missing Gemini API key. Enter it above.')).toBeInTheDocument()
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

    expect(screen.getByText('Receipt Difference')).toBeInTheDocument()
    expect(screen.queryByText('S$0.01')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Receipt Total \(optional\)/i), {
      target: { value: '12.00' },
    })
    expect(screen.getByText('S$0.01')).toBeInTheDocument()
  })

  it('renders export section and invokes export generation', async () => {
    render(<ReceiptSplitterPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Generate Final Split Image' }))

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
})

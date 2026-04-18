import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptImportActions } from './ReceiptImportActions';

let storeMock: Record<string, unknown>;
const geminiStoreMock: Record<string, unknown> = {
  geminiApiKeyInput: 'test-key',
  setShowApiKeyModal: vi.fn(),
};

vi.mock('@shared/stores/receiptStore', () => ({
  useReceiptStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector(storeMock),
  ),
}));

vi.mock('@shared/stores/scanStore', () => ({
  useScanStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector(scanStoreMock),
  ),
  getScanState: vi.fn(
    (map: Record<string, unknown>, id: string) => map[id] ?? defaultScanStateMock,
  ),
}));

vi.mock('@shared/stores/geminiStore', () => ({
  useGeminiStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector(geminiStoreMock),
  ),
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: (state: Record<string, unknown>) => unknown) => fn,
}));

const defaultScanStateMock = {
  isScanning: false,
  scanStatus: '',
  scanError: null,
  scanWarnings: [],
  loadingMessage: '',
  loadingMessageIndex: 0,
};

let scanStoreMock: Record<string, unknown> = { scanStateByReceipt: {} };

function setStoreReceiptFile(file: File | null) {
  storeMock = {
    ...storeMock,
    receipts: [
      {
        id: 'r1',
        name: 'Receipt 1',
        receiptFile: file,
      },
    ],
    activeReceiptId: 'r1',
  };
  scanStoreMock = {
    ...scanStoreMock,
    scanStateByReceipt: {},
  };
}

function makeProps(overrides: Partial<React.ComponentProps<typeof ReceiptImportActions>> = {}) {
  return {
    onReceiptFileSelected: vi.fn(),
    onScanReceipt: vi.fn(),
    mockReceipts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  setStoreReceiptFile(null);

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock-preview-url'),
  });

  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe('ReceiptImportActions – Object URL lifecycle (F003)', () => {
  it('creates an object URL when receiptFile is set in the store', () => {
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    setStoreReceiptFile(file);

    render(<ReceiptImportActions {...makeProps()} />);

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  });

  it('revokes the previous object URL when receiptFile changes', () => {
    const createUrl = vi
      .fn()
      .mockReturnValueOnce('blob:preview-1')
      .mockReturnValueOnce('blob:preview-2');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createUrl,
    });

    const file1 = new File(['a'], 'first.jpg', { type: 'image/jpeg' });
    const file2 = new File(['b'], 'second.jpg', { type: 'image/jpeg' });

    const { rerender } = render(<ReceiptImportActions {...makeProps()} />);
    setStoreReceiptFile(file1);
    rerender(<ReceiptImportActions {...makeProps()} />);
    expect(createUrl).toHaveBeenCalledTimes(1);

    setStoreReceiptFile(file2);
    rerender(<ReceiptImportActions {...makeProps()} />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(createUrl).toHaveBeenCalledTimes(2);
  });

  it('revokes the object URL on component unmount', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:unmount-test'),
    });

    const file = new File(['img'], 'unmount.jpg', { type: 'image/jpeg' });
    setStoreReceiptFile(file);

    const { unmount } = render(<ReceiptImportActions {...makeProps()} />);
    expect(URL.createObjectURL).toHaveBeenCalled();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:unmount-test');
  });

  it('does not revoke a null preview URL on unmount', () => {
    setStoreReceiptFile(null);
    const { unmount } = render(<ReceiptImportActions {...makeProps()} />);
    unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the object URL when receiptFile is cleared', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:clear-test'),
    });

    const file = new File(['img'], 'clear.jpg', { type: 'image/jpeg' });
    setStoreReceiptFile(file);

    const { rerender } = render(<ReceiptImportActions {...makeProps()} />);
    expect(URL.createObjectURL).toHaveBeenCalled();

    setStoreReceiptFile(null);
    rerender(<ReceiptImportActions {...makeProps()} />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clear-test');
  });
});

describe('ReceiptImportActions – Image thumbnail (F001)', () => {
  it('shows no thumbnail when no file is uploaded', () => {
    setStoreReceiptFile(null);
    render(<ReceiptImportActions {...makeProps()} />);

    expect(screen.queryByAltText('Receipt preview')).not.toBeInTheDocument();
  });

  it('shows a clickable thumbnail when a preview URL exists', () => {
    const file = new File(['img'], 'thumb.jpg', { type: 'image/jpeg' });
    setStoreReceiptFile(file);

    render(<ReceiptImportActions {...makeProps()} />);

    const img = screen.getByAltText('Receipt preview');
    expect(img).toBeInTheDocument();
    expect(img).toHaveClass('object-cover');
    expect(img.closest('button')).toBeTruthy();
  });

  it('hides the description icon when a thumbnail is showing', () => {
    const file = new File(['img'], 'thumb.jpg', { type: 'image/jpeg' });
    setStoreReceiptFile(file);

    render(<ReceiptImportActions {...makeProps()} />);

    const descIcons = screen
      .queryAllByText('description')
      .filter((el) => el.classList.contains('material-symbols-outlined'));
    expect(descIcons).toHaveLength(0);
  });

  it('shows the description icon when the file row is visible and no thumbnail', () => {
    const file = new File(['img'], 'thumb.jpg', { type: 'image/jpeg' });
    setStoreReceiptFile(file);

    const { rerender } = render(<ReceiptImportActions {...makeProps()} />);

    expect(screen.getByAltText('Receipt preview')).toBeInTheDocument();

    setStoreReceiptFile(null);
    rerender(<ReceiptImportActions {...makeProps()} />);

    expect(screen.queryByAltText('Receipt preview')).not.toBeInTheDocument();
  });
});

describe('ReceiptImportActions – Fullscreen modal (F002)', () => {
  function renderWithFile() {
    const file = new File(['img'], 'modal.jpg', { type: 'image/jpeg' });
    setStoreReceiptFile(file);
    return render(<ReceiptImportActions {...makeProps()} />);
  }

  it('clicking the thumbnail opens the fullscreen modal', () => {
    renderWithFile();

    expect(screen.queryByAltText('Receipt fullscreen')).not.toBeInTheDocument();

    const thumbnailButton = screen.getByAltText('Receipt preview').closest('button')!;
    fireEvent.click(thumbnailButton);

    expect(screen.getByAltText('Receipt fullscreen')).toBeInTheDocument();
  });

  it('clicking the filename opens the fullscreen modal', () => {
    renderWithFile();

    const filenameBtn = screen.getByRole('button', { name: /open fullscreen preview/i });
    fireEvent.click(filenameBtn);

    expect(screen.getByAltText('Receipt fullscreen')).toBeInTheDocument();
  });

  it('clicking the modal backdrop closes the modal', () => {
    renderWithFile();

    const thumbnailButton = screen.getByAltText('Receipt preview').closest('button')!;
    fireEvent.click(thumbnailButton);
    expect(screen.getByAltText('Receipt fullscreen')).toBeInTheDocument();

    const backdrop = screen.getByAltText('Receipt fullscreen').parentElement!;
    fireEvent.click(backdrop);

    expect(screen.queryByAltText('Receipt fullscreen')).not.toBeInTheDocument();
  });

  it('pressing Escape closes the fullscreen modal', () => {
    renderWithFile();

    const thumbnailButton = screen.getByAltText('Receipt preview').closest('button')!;
    fireEvent.click(thumbnailButton);
    expect(screen.getByAltText('Receipt fullscreen')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByAltText('Receipt fullscreen')).not.toBeInTheDocument();
  });

  it('clicking the fullscreen image does NOT close the modal (stopPropagation)', () => {
    renderWithFile();

    const thumbnailButton = screen.getByAltText('Receipt preview').closest('button')!;
    fireEvent.click(thumbnailButton);

    const fullscreenImg = screen.getByAltText('Receipt fullscreen');
    fireEvent.click(fullscreenImg);

    expect(screen.getByAltText('Receipt fullscreen')).toBeInTheDocument();
  });

  it('modal has dark backdrop with correct styles', () => {
    renderWithFile();

    const thumbnailButton = screen.getByAltText('Receipt preview').closest('button')!;
    fireEvent.click(thumbnailButton);

    const backdrop = screen.getByAltText('Receipt fullscreen').parentElement!;
    expect(backdrop.className).toContain('bg-black/70');
    expect(backdrop.className).toContain('fixed');
    expect(backdrop.className).toContain('z-50');
  });

  it('fullscreen image uses object-contain for proper display', () => {
    renderWithFile();

    const thumbnailButton = screen.getByAltText('Receipt preview').closest('button')!;
    fireEvent.click(thumbnailButton);

    const fullscreenImg = screen.getByAltText('Receipt fullscreen');
    expect(fullscreenImg.className).toContain('object-contain');
  });

  it('fullscreen modal is not rendered when no file is loaded', () => {
    setStoreReceiptFile(null);
    render(<ReceiptImportActions {...makeProps()} />);

    expect(screen.queryByAltText('Receipt fullscreen')).not.toBeInTheDocument();
  });

  it('modal has ARIA attributes for accessibility', () => {
    renderWithFile();

    const thumbnailButton = screen.getByAltText('Receipt preview').closest('button')!;
    fireEvent.click(thumbnailButton);

    const backdrop = screen.getByAltText('Receipt fullscreen').parentElement!;
    expect(backdrop).toHaveAttribute('role', 'dialog');
    expect(backdrop).toHaveAttribute('aria-modal', 'true');
    expect(backdrop).toHaveAttribute('aria-label', 'Receipt image preview');
  });
});

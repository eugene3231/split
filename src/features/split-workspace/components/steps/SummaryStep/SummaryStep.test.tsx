import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChargeState, Receipt, SplitResult } from '@shared/types';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { SummaryStep } from './SummaryStep';

const useSummaryModelMock = vi.hoisted(() => vi.fn());

vi.mock('./useSummaryModel', () => ({
  useSummaryModel: useSummaryModelMock,
}));

vi.mock('./useSummaryExport', () => ({
  useSummaryExport: () => ({
    busy: false,
    copied: false,
    exportError: null,
    previewUrl: null,
    download: vi.fn(),
    preview: vi.fn(),
    share: vi.fn(),
    closePreview: vi.fn(),
  }),
}));

function makeCharge(): ChargeState {
  return {
    enabled: false,
    mode: 'percent',
    amountInput: '',
    percentInput: '',
    detectedConfidence: null,
    detectedSource: null,
  };
}

function makeReceipt(id: string, name: string): Receipt {
  return {
    id,
    name,
    items: [],
    discount: makeCharge(),
    serviceCharge: makeCharge(),
    gst: makeCharge(),
    receiptTotalInput: '',
    currency: 'SGD',
    exchangeRateOverride: null,
  };
}

function makeSplit(totalCents: number): SplitResult {
  return {
    lineItemsByPerson: {},
    involvedCountByPerson: {},
    subtotalByPersonCents: {},
    discountByPersonCents: {},
    serviceByPersonCents: {},
    gstByPersonCents: {},
    totalByPersonCents: {},
    subtotalCents: totalCents,
    discountCents: 0,
    serviceChargeCents: 0,
    gstCents: 0,
    grandTotalCents: totalCents,
    unassignedItemCount: 0,
  };
}

describe('SummaryStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const receipts = [makeReceipt('r1', 'First receipt'), makeReceipt('r2', 'Second receipt')];
    const split = makeSplit(3000);

    useReceiptStore.setState({
      peopleInput: '',
      initialized: true,
      people: [],
      receipts,
      activeReceiptId: 'r1',
      payerMobile: '',
    });

    useSummaryModelMock.mockReturnValue({
      people: [],
      receipts,
      isMultiReceipt: true,
      activeSummaryReceipt: receipts[0],
      renameReceipt: vi.fn(),
      payerMobile: '',
      splitByReceipt: [makeSplit(1000), makeSplit(2000)],
      reconciliation: {
        cents: null,
        applyCorrectiveDiscount: vi.fn(),
      },
      view: {
        kind: 'total',
        displaySplit: split,
        displayCurrency: 'SGD',
        grandTotal: 3000,
        discount: makeCharge(),
        serviceCharge: makeCharge(),
        gst: makeCharge(),
        sgdSplit: split,
        hasAnyForeign: false,
        foreignRates: [],
        receiptBreakdowns: [],
      },
      qrDataUrls: {},
    });
  });

  it('labels the total tab hero card as Grand total instead of the first receipt name', () => {
    render(<SummaryStep onAddReceipt={vi.fn()} />);

    expect(screen.getByText('Grand total')).toBeInTheDocument();
  });

  it('calls onAddReceipt from the summary tabs plus control', () => {
    const onAddReceipt = vi.fn();
    render(<SummaryStep onAddReceipt={onAddReceipt} />);

    fireEvent.click(screen.getByTestId('summary-add-receipt-btn'));
    expect(onAddReceipt).toHaveBeenCalledTimes(1);
  });

  it('renders below-threshold people as expandable payment cards', async () => {
    const people = [
      { id: 'p1', name: 'Theo' },
      { id: 'p2', name: 'Maya' },
    ];
    const receipt = makeReceipt('r1', 'Dinner');
    const split = makeSplit(3000);
    split.grandTotalCents = 3000;
    split.subtotalCents = 3000;
    split.totalByPersonCents = { p1: 1435, p2: 1565 };
    split.subtotalByPersonCents = { p1: 1435, p2: 1565 };
    split.lineItemsByPerson = {
      p1: [
        {
          itemId: 'i1',
          name: 'Pasta Alfredo',
          grossAmountCents: 1435,
          discountPercent: 0,
          discountAmountCents: 0,
          netAmountCents: 1435,
          assignedAmountCents: 1435,
          splitCount: 1,
          involved: true,
        },
      ],
      p2: [],
    };

    useReceiptStore.setState({
      people,
      receipts: [receipt],
      activeReceiptId: 'r1',
      payerMobile: '',
    });
    useSummaryModelMock.mockReturnValue({
      people,
      receipts: [receipt],
      isMultiReceipt: false,
      activeSummaryReceipt: receipt,
      renameReceipt: vi.fn(),
      payerMobile: '',
      splitByReceipt: [split],
      reconciliation: {
        cents: null,
        applyCorrectiveDiscount: vi.fn(),
      },
      view: {
        kind: 'receipt',
        receipt,
        nativeCurrency: 'SGD',
        isForeign: false,
        effectiveRate: null,
        displaySplit: split,
        displayCurrency: 'SGD',
        grandTotal: 3000,
        discount: makeCharge(),
        serviceCharge: makeCharge(),
        gst: makeCharge(),
        sgdSplit: split,
      },
      qrDataUrls: {},
    });

    render(<SummaryStep onAddReceipt={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Pasta Alfredo')).toBeInTheDocument());
    expect(screen.getByText('Per person · 1 item')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Maya/ }));

    await waitFor(() => expect(screen.queryByText('Pasta Alfredo')).not.toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Show PayNow QR/i })).toHaveLength(1);
  });

  it('opens a PayNow sheet that treats the card person as paying the global receiver', async () => {
    const people = [{ id: 'p1', name: 'Theo' }];
    const receipt = makeReceipt('r1', 'Dinner');
    const split = makeSplit(1435);
    split.grandTotalCents = 1435;
    split.totalByPersonCents = { p1: 1435 };
    split.subtotalByPersonCents = { p1: 1435 };
    split.lineItemsByPerson = { p1: [] };

    useReceiptStore.setState({
      people,
      receipts: [receipt],
      activeReceiptId: 'r1',
      payerMobile: '9123 4567',
    });
    useSummaryModelMock.mockReturnValue({
      people,
      receipts: [receipt],
      isMultiReceipt: false,
      activeSummaryReceipt: receipt,
      renameReceipt: vi.fn(),
      payerMobile: '9123 4567',
      splitByReceipt: [split],
      reconciliation: {
        cents: null,
        applyCorrectiveDiscount: vi.fn(),
      },
      view: {
        kind: 'receipt',
        receipt,
        nativeCurrency: 'SGD',
        isForeign: false,
        effectiveRate: null,
        displaySplit: split,
        displayCurrency: 'SGD',
        grandTotal: 1435,
        discount: makeCharge(),
        serviceCharge: makeCharge(),
        gst: makeCharge(),
        sgdSplit: split,
      },
      qrDataUrls: {
        p1: 'data:image/png;base64,qr',
      },
    });

    render(<SummaryStep onAddReceipt={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Show PayNow QR/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Show PayNow QR/i }));

    expect(screen.getByText('Theo owes')).toBeInTheDocument();
    expect(screen.getByLabelText('PayNow number - receiver')).toHaveValue('9123 4567');
    expect(
      screen.getByText("This is the bill payer's number. Theo pays this receiver."),
    ).toBeInTheDocument();
    expect(screen.getByAltText('PayNow QR for Theo to pay the bill payer')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PayNow number - receiver'), {
      target: { value: '8123 4567' },
    });

    expect(useReceiptStore.getState().payerMobile).toBe('8123 4567');
  });

  it('keeps foreign currency controls near the total summary', () => {
    const receipt = { ...makeReceipt('r1', 'Dinner'), currency: 'MYR' };
    const split = makeSplit(14750);

    useReceiptStore.setState({
      people: [],
      receipts: [receipt],
      activeReceiptId: 'r1',
      payerMobile: '',
    });
    useSummaryModelMock.mockReturnValue({
      people: [],
      receipts: [receipt],
      isMultiReceipt: false,
      activeSummaryReceipt: receipt,
      renameReceipt: vi.fn(),
      payerMobile: '',
      splitByReceipt: [split],
      reconciliation: {
        cents: null,
        applyCorrectiveDiscount: vi.fn(),
      },
      view: {
        kind: 'receipt',
        receipt,
        nativeCurrency: 'MYR',
        isForeign: true,
        effectiveRate: 0.3219,
        displaySplit: split,
        displayCurrency: 'MYR',
        grandTotal: 14750,
        discount: makeCharge(),
        serviceCharge: makeCharge(),
        gst: makeCharge(),
        sgdSplit: split,
      },
      qrDataUrls: {},
    });

    render(<SummaryStep onAddReceipt={vi.fn()} />);

    expect(screen.getByRole('button', { name: /MYR/ })).toBeInTheDocument();
    expect(screen.getByText(/1 SGD =/)).toBeInTheDocument();
  });
});

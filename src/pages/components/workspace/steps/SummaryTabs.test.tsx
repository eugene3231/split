import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SummaryTabs } from './SummaryTabs';
import type { Receipt } from '@shared/types';

const makeReceipt = (id: string, name: string): Receipt =>
  ({
    id,
    name,
    items: [],
    discount: {
      enabled: false,
      mode: 'percent',
      amountInput: '',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    },
    serviceCharge: {
      enabled: false,
      mode: 'percent',
      amountInput: '',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    },
    gst: {
      enabled: false,
      mode: 'percent',
      amountInput: '',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    },
    receiptTotalInput: '',
    currency: 'SGD',
    exchangeRateOverride: null,
  }) as Receipt;

describe('SummaryTabs', () => {
  it('renders total tab and individual receipt tabs', () => {
    const receipts = [makeReceipt('r1', 'Dinner'), makeReceipt('r2', 'Lunch')];
    render(
      <SummaryTabs
        receipts={receipts}
        activeTab="total"
        onTabChange={vi.fn()}
        onRenameReceipt={vi.fn()}
      />,
    );

    expect(screen.getByTestId('summary-tab-total')).toBeInTheDocument();
    expect(screen.getByTestId('summary-tab-receipt-0')).toBeInTheDocument();
    expect(screen.getByTestId('summary-tab-receipt-1')).toBeInTheDocument();
  });

  it('calls onTabChange when a receipt tab is clicked', () => {
    const onTabChange = vi.fn();
    const receipts = [makeReceipt('r1', 'Dinner')];
    render(
      <SummaryTabs
        receipts={receipts}
        activeTab="total"
        onTabChange={onTabChange}
        onRenameReceipt={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('summary-tab-receipt-0'));
    expect(onTabChange).toHaveBeenCalledWith('r1');
  });

  it('calls onTabChange when the total tab is clicked', () => {
    const onTabChange = vi.fn();
    const receipts = [makeReceipt('r1', 'Dinner')];
    render(
      <SummaryTabs
        receipts={receipts}
        activeTab="r1"
        onTabChange={onTabChange}
        onRenameReceipt={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('summary-tab-total'));
    expect(onTabChange).toHaveBeenCalledWith('total');
  });

  it('highlights the active tab', () => {
    const receipts = [makeReceipt('r1', 'Dinner')];
    render(
      <SummaryTabs
        receipts={receipts}
        activeTab="r1"
        onTabChange={vi.fn()}
        onRenameReceipt={vi.fn()}
      />,
    );

    const receiptTab = screen.getByTestId('summary-tab-receipt-0');
    expect(receiptTab.className).toContain('bg-primary');
  });
});

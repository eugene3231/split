import { useEffect, useMemo, useRef, useState } from 'react';
import { generateReceiptSplitImageLight } from '@features/sharing/logic/receiptSplitImageLight';
import { generateOverviewTableImage } from '@features/sharing/logic/overviewTableImage';
import {
  buildDownloadFilename,
  buildSplitShareText,
  downloadImage,
  shareText,
} from '@features/sharing/logic/shareSplit';
import { buildSummaryExportPayload } from '@features/split-workspace/logic/buildSummaryExportPayload';
import type { SummaryModel } from './useSummaryModel';
import type { SummaryMode } from './SummaryModeToggle';

export type SummaryExportState =
  | { kind: 'idle' }
  | { kind: 'busy'; action: 'download' | 'preview' | 'share' }
  | { kind: 'text-success'; method: Awaited<ReturnType<typeof shareText>> }
  | { kind: 'manual-copy'; message: string }
  | { kind: 'error'; message: string };

interface UseSummaryExportArgs {
  model: Pick<
    SummaryModel,
    'people' | 'reconciliation' | 'view' | 'summaryBreakdown' | 'summaryOverview'
  >;
  includeItemDetails: boolean;
  mode: SummaryMode;
}

export function useSummaryExport({ model, includeItemDetails, mode }: UseSummaryExportArgs) {
  const [exportState, setExportState] = useState<SummaryExportState>({ kind: 'idle' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  const payload = useMemo(
    () => buildSummaryExportPayload({ model, includeItemDetails }),
    [model, includeItemDetails],
  );
  const text = buildSplitShareText({
    people: model.people,
    receiptName: payload.receiptName ?? '',
    split: model.view.displaySplit,
    currency: model.view.displayCurrency,
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // The image follows whichever view is on screen: the person cards or the overview table.
  const generateImage = () =>
    mode === 'overview'
      ? generateOverviewTableImage({ overview: model.summaryOverview, title: payload.receiptName })
      : generateReceiptSplitImageLight(payload);

  const beginAction = (action: Extract<SummaryExportState, { kind: 'busy' }>['action']) => {
    if (successTimeoutRef.current !== null) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setExportState({ kind: 'busy', action });
  };

  const download = async () => {
    beginAction('download');
    try {
      const blob = await generateImage();
      downloadImage(
        blob,
        buildDownloadFilename(mode === 'overview' ? 'overview' : 'split', payload.receiptName),
      );
      setExportState({ kind: 'idle' });
    } catch {
      setExportState({ kind: 'error', message: 'Failed to generate image.' });
    }
  };

  const preview = async () => {
    beginAction('preview');
    try {
      const blob = await generateImage();
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
      setExportState({ kind: 'idle' });
    } catch {
      setExportState({ kind: 'error', message: 'Failed to generate preview.' });
    }
  };

  const share = async () => {
    beginAction('share');
    try {
      const method = await shareText(text);
      setExportState({ kind: 'text-success', method });
      successTimeoutRef.current = window.setTimeout(() => {
        setExportState({ kind: 'idle' });
        successTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setExportState({ kind: 'idle' });
        return;
      }
      setExportState({
        kind: 'manual-copy',
        message: 'Unable to share or copy automatically. Select the text below and copy it.',
      });
    }
  };

  const closePreview = () => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  return {
    exportState,
    text,
    previewUrl,
    download,
    preview,
    share,
    closePreview,
  };
}

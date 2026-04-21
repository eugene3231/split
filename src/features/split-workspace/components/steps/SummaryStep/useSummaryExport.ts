import { useEffect, useMemo, useRef, useState } from 'react';
import { generateReceiptSplitImageLight } from '@features/sharing/logic/receiptSplitImageLight';
import {
  buildDownloadFilename,
  buildSplitShareText,
  downloadImage,
  shareText,
} from '@features/sharing/logic/shareSplit';
import { buildSummaryExportPayload } from '@features/split-workspace/logic/buildSummaryExportPayload';
import type { SummaryModel } from './useSummaryModel';

type ExportBusy = 'downloading' | 'copying' | 'previewing' | null;

type UseSummaryExportArgs = {
  model: Pick<
    SummaryModel,
    'people' | 'receipts' | 'payerMobile' | 'reconciliation' | 'splitByReceipt' | 'view'
  >;
  includeItemDetails: boolean;
  showBaseCurrency: boolean;
};

export function useSummaryExport({
  model,
  includeItemDetails,
  showBaseCurrency,
}: UseSummaryExportArgs) {
  const [busy, setBusy] = useState<ExportBusy>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const payload = useMemo(
    () => buildSummaryExportPayload({ model, includeItemDetails, showBaseCurrency }),
    [model, includeItemDetails, showBaseCurrency],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const download = async () => {
    setBusy('downloading');
    setExportError(null);
    try {
      const blob = await generateReceiptSplitImageLight(payload);
      downloadImage(blob, buildDownloadFilename('split', payload.receiptName));
    } catch {
      setExportError('Failed to generate image.');
    } finally {
      setBusy(null);
    }
  };

  const preview = async () => {
    setBusy('previewing');
    setExportError(null);
    try {
      const blob = await generateReceiptSplitImageLight(payload);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    } catch {
      setExportError('Failed to generate preview.');
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('copying');
    const text = buildSplitShareText({
      people: model.people,
      receiptName: payload.receiptName ?? '',
      split: model.view.displaySplit,
      currency: model.view.displayCurrency,
    });
    try {
      await shareText(text);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    } finally {
      setBusy(null);
    }
  };

  const closePreview = () => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  return {
    busy,
    copied,
    exportError,
    previewUrl,
    download,
    preview,
    share,
    closePreview,
  };
}

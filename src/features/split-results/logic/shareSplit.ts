import type { Person, SplitResult } from '@shared/types';
import { formatCurrencyFromCents } from '@shared/logic/core/money';

type ShareNavigator = Pick<Navigator, 'share' | 'canShare' | 'clipboard'>;

type ShareSupport = 'native' | 'fallback';

export function buildSplitShareText(args: {
  people: Person[];
  receiptName: string;
  split: SplitResult;
  currency?: string;
}): string {
  const lines = [
    `${args.receiptName} total: ${formatCurrencyFromCents(args.split.grandTotalCents, args.currency)}\n`,
  ];

  for (const person of args.people) {
    lines.push(
      `${person.name}: ${formatCurrencyFromCents(args.split.totalByPersonCents[person.id] ?? 0, args.currency)}`,
    );
  }

  return lines.join('\n');
}

export function getShareSupport(
  navigatorLike: ShareNavigator | undefined = getNavigator(),
): ShareSupport {
  if (!navigatorLike || typeof navigatorLike.share !== 'function') {
    return 'fallback';
  }
  return 'native';
}

export async function copyShareText(
  text: string,
  navigatorLike: ShareNavigator | undefined = getNavigator(),
): Promise<void> {
  if (!navigatorLike?.clipboard || typeof navigatorLike.clipboard.writeText !== 'function') {
    throw new Error('Copy is not available on this device.');
  }

  await navigatorLike.clipboard.writeText(text);
}

export async function shareText(
  text: string,
  navigatorLike: ShareNavigator | undefined = getNavigator(),
): Promise<ShareSupport> {
  if (!navigatorLike || typeof navigatorLike.share !== 'function') {
    await copyShareText(text, navigatorLike);
    return 'fallback';
  }

  try {
    await navigatorLike.share({ text });
    return 'native';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    await copyShareText(text, navigatorLike);
    return 'fallback';
  }
}

export function downloadImage(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getNavigator(): ShareNavigator | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return navigator;
}

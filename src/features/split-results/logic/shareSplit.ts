import type { Person, SplitResult } from '@shared/types'
import { formatCurrencyFromCents } from '@shared/logic/core/money'

type ShareNavigator = Pick<Navigator, 'share' | 'canShare' | 'clipboard'>

type ShareSupport = 'native' | 'fallback'

type ShareFinalSplitOptions = {
  image: Blob
  fileName: string
  navigator?: ShareNavigator
}

export function buildSplitShareText(args: { people: Person[]; receiptName: string; split: SplitResult; currency?: string }): string {
  const lines = [`${args.receiptName} total: ${formatCurrencyFromCents(args.split.grandTotalCents, args.currency)}\n`]

  for (const person of args.people) {
    lines.push(`${person.name}: ${formatCurrencyFromCents(args.split.totalByPersonCents[person.id] ?? 0, args.currency)}`)
  }

  return lines.join('\n')
}

export function getShareSupport(
  navigatorLike: ShareNavigator | undefined = getNavigator(),
): ShareSupport {
  if (!navigatorLike || typeof navigatorLike.share !== 'function') {
    return 'fallback'
  }

  if (typeof File === 'undefined') {
    return 'fallback'
  }

  if (typeof navigatorLike.canShare === 'function') {
    const probeFile = new File([''], 'split-final.png', { type: 'image/png' })
    return navigatorLike.canShare({ files: [probeFile] }) ? 'native' : 'fallback'
  }

  return 'native'
}

export async function copyShareText(
  text: string,
  navigatorLike: ShareNavigator | undefined = getNavigator(),
): Promise<void> {
  if (!navigatorLike?.clipboard || typeof navigatorLike.clipboard.writeText !== 'function') {
    throw new Error('Copy is not available on this device.')
  }

  await navigatorLike.clipboard.writeText(text)
}

export async function shareFinalSplit(options: ShareFinalSplitOptions): Promise<ShareSupport> {
  const navigatorLike = options.navigator ?? getNavigator()
  if (!navigatorLike || typeof navigatorLike.share !== 'function') {
    return 'fallback'
  }

  if (typeof File === 'undefined') {
    return 'fallback'
  }

  const file = new File([options.image], options.fileName, { type: options.image.type || 'image/png' })

  if (typeof navigatorLike.canShare === 'function' && !navigatorLike.canShare({ files: [file] })) {
    return 'fallback'
  }

  try {
    await navigatorLike.share({ files: [file] })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    return 'fallback'
  }

  return 'native'
}

export function downloadImage(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function getNavigator(): ShareNavigator | undefined {
  if (typeof navigator === 'undefined') {
    return undefined
  }

  return navigator
}

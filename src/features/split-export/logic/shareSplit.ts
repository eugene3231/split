import type { Person, SplitResult } from '../../../shared/types'
import { formatCurrencyFromCents } from '../../../shared/logic/core/money'

type ShareNavigator = Pick<Navigator, 'share' | 'canShare' | 'clipboard'>

type ShareSupport = 'native' | 'fallback'

type ShareFinalSplitOptions = {
  text: string
  image: Blob
  fileName: string
  navigator?: ShareNavigator
}

export function buildSplitShareText(args: { people: Person[]; split: SplitResult }): string {
  const lines = [`Split total: ${formatCurrencyFromCents(args.split.grandTotalCents)}`]

  for (const person of args.people) {
    lines.push(`${person.name}: ${formatCurrencyFromCents(args.split.totalByPersonCents[person.id] ?? 0)}`)
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
    return 'native'
  }

  if (typeof navigatorLike.canShare !== 'function') {
    return 'native'
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

  const textOnlyPayload = { text: options.text }
  const supportsFiles =
    typeof File !== 'undefined' &&
    (typeof navigatorLike.canShare !== 'function' ||
      navigatorLike.canShare({
        files: [new File([''], options.fileName, { type: options.image.type || 'image/png' })],
      }))

  if (!supportsFiles) {
    await navigatorLike.share(textOnlyPayload)
    return 'native'
  }

  const file = new File([options.image], options.fileName, { type: options.image.type || 'image/png' })

  try {
    await navigatorLike.share({
      ...textOnlyPayload,
      files: [file],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    await navigatorLike.share(textOnlyPayload)
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

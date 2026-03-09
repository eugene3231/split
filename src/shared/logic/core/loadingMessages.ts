export const FUNNY_LOADING_MESSAGES = [
  'Asking Gemini to decipher cryptic cashier handwriting...',
  'Negotiating with suspiciously smudged totals...',
  'Politely requesting line items to stand in a straight line...',
  'Convincing decimals to stay exactly where they belong...',
  'Scanning for rogue service charge surprises...',
  'Calibrating neural napkin math...',
  'Bribing OCR goblins with synthetic compliments...',
  'Running a tiny committee of transformer experts...',
  'Summoning receipts from the shadow realm of camera blur...',
  'Translating cashier hieroglyphics into plain numbers...',
  'Asking the model to stop hallucinating extra appetizers...',
  'Teaching tokenizers the difference between 8 and B...',
  'Sending a polite ping to the cloud brain trust...',
  'Checking whether that total includes emotional damage...',
  'Aligning subtotal chakras with tax reality...',
  'Convincing entropy to format currency correctly...',
  'Cross-examining every item like an AI detective...',
  'Turning pixel soup into itemized truth...',
  'Computing split fairness with excessive machine confidence...',
  'Waiting for the model to finish its dramatic pause...',
] as const

export function getRandomLoadingMessageIndex(excludeIndex?: number): number {
  const messageCount = FUNNY_LOADING_MESSAGES.length
  if (messageCount <= 1) return 0

  if (excludeIndex === undefined || excludeIndex < 0 || excludeIndex >= messageCount) {
    return Math.floor(Math.random() * messageCount)
  }

  // Pick any other message index to avoid immediate repeats.
  const offset = Math.floor(Math.random() * (messageCount - 1)) + 1
  return (excludeIndex + offset) % messageCount
}

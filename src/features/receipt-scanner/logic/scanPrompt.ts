export const RECEIPT_SCAN_PROMPT = [
  'Extract structured receipt data from the attached file.',
  'If unsure, set nullable fields to null and add a warning.',
  'Amounts must be numbers, not strings.',
].join('\n');

export const MAX_LABEL_CODE_LENGTH = 12;

/** Code encoded in barcode / QR labels (max 12 characters). */
export function normalizeLabelScancode(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.length <= MAX_LABEL_CODE_LENGTH) return value;
  return value.slice(0, MAX_LABEL_CODE_LENGTH);
}

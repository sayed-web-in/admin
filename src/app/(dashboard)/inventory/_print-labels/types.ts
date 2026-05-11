export type PrintLabelKind = "barcode" | "qrcode";

export interface LabelItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variant: string;
  batchNumber: string;
  batchId: string;
  /** Batch barcode or fallback to batch number — encoded in barcode / QR. */
  scancode: string;
  quantity: number;
  price?: number;
  selected: boolean;
}

export type LabelPaperSize = "A4" | "A5" | "Letter" | "Custom";

export interface LabelSettings {
  paperSize: LabelPaperSize;
  showStoreName: boolean;
  showBatch: boolean;
  showProductName: boolean;
  showVariant: boolean;
  showPrice: boolean;
}

export interface LabelPreview {
  kind: PrintLabelKind;
  items: LabelItem[];
  settings: LabelSettings;
  storeName?: string;
}

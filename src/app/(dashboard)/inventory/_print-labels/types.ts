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

export type PrintMode = "sheet" | "thermal";

export type SheetPaperSize = "A4" | "A5" | "Letter";

export type ThermalLabelSize = "40x30" | "50x30" | "55x35" | "60x40" | "76x50";

/** @deprecated Use SheetPaperSize */
export type LabelPaperSize = SheetPaperSize | "Custom";

export interface LabelSettings {
  printMode: PrintMode;
  paperSize: SheetPaperSize;
  thermalSize: ThermalLabelSize;
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

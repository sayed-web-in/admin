import type { LabelSettings, ThermalLabelSize } from "./types";

export const THERMAL_LABEL_PRESETS: ReadonlyArray<{
  value: ThermalLabelSize;
  label: string;
  widthMm: number;
  heightMm: number;
}> = [
  { value: "40x30", label: "40 × 30 mm", widthMm: 40, heightMm: 30 },
  { value: "50x30", label: "50 × 30 mm", widthMm: 50, heightMm: 30 },
  { value: "60x40", label: "60 × 40 mm", widthMm: 60, heightMm: 40 },
  { value: "76x50", label: "76 × 50 mm (GP-3120TUC max)", widthMm: 76, heightMm: 50 },
];

export interface LabelDimensions {
  isThermal: boolean;
  widthMm: number;
  heightMm: number;
  pageCss: string;
}

export interface BarcodeRenderOptions {
  height: number;
  width: number;
  fontSize: number;
  textMargin: number;
  storeFont: number;
  productFont: number;
  metaFont: number;
  priceFont: number;
  qrSize: number;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveLabelDimensions(settings: LabelSettings): LabelDimensions {
  if (settings.printMode === "thermal") {
    const preset =
      THERMAL_LABEL_PRESETS.find((p) => p.value === settings.thermalSize) ??
      THERMAL_LABEL_PRESETS[1];
    return {
      isThermal: true,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      pageCss: `${preset.widthMm}mm ${preset.heightMm}mm`,
    };
  }
  return {
    isThermal: false,
    widthMm: 0,
    heightMm: 0,
    pageCss: settings.paperSize,
  };
}

const MM_TO_PX = 3.7795275591;

export interface QrLabelLayout {
  qrSizePx: number;
  qrSizeMm: number;
  showScancodeText: boolean;
  /** qrcodejs CorrectLevel numeric value (L=1, M=0, H=2). */
  correctLevelJs: number;
}

function toQrJsCorrectLevel(level: number): number {
  if (level === 0) return 1;
  if (level === 2) return 2;
  return 0;
}

export function getQrLabelLayout(
  settings: LabelSettings,
  context?: { storeName?: string; scancodeLength?: number }
): QrLabelLayout {
  const dims = resolveLabelDimensions(settings);
  const scancodeLength = context?.scancodeLength ?? 0;

  if (!dims.isThermal) {
    return {
      qrSizePx: 120,
      qrSizeMm: 0,
      showScancodeText: true,
      correctLevelJs: 2,
    };
  }

  let textLines = 0;
  if (settings.showStoreName && context?.storeName) textLines++;
  if (settings.showProductName) textLines++;
  if (settings.showVariant) textLines++;
  if (settings.showBatch) textLines++;
  if (settings.showPrice) textLines++;

  const h = dims.heightMm;
  const w = dims.widthMm;
  const lineMm = h <= 30 ? 2.3 : h <= 40 ? 2.6 : 3;
  const paddingMm = 2;
  const showScancodeText = h > 30;
  const scancodeTextMm = showScancodeText ? (h <= 40 ? 2.5 : 3.5) : 0;
  const usedHeightMm = paddingMm + textLines * lineMm + scancodeTextMm;
  const qrByHeight = h - usedHeightMm;
  const qrByWidth = w - 3;
  let qrSizeMm = Math.min(qrByHeight, qrByWidth);
  qrSizeMm = Math.max(12, Math.min(qrSizeMm, w - 2));

  if (scancodeLength > 28 && h <= 30) {
    qrSizeMm = Math.min(qrSizeMm, 15);
  } else if (scancodeLength > 35) {
    qrSizeMm = Math.min(qrSizeMm, Math.max(12, w - 6));
  }

  let correctLevel = 1;
  if (scancodeLength > 36 || (scancodeLength > 24 && h <= 40)) {
    correctLevel = 0;
  } else if (scancodeLength < 18) {
    correctLevel = 2;
  }

  return {
    qrSizePx: Math.round(qrSizeMm * MM_TO_PX),
    qrSizeMm: Math.round(qrSizeMm * 10) / 10,
    showScancodeText,
    correctLevelJs: toQrJsCorrectLevel(correctLevel),
  };
}

export function getBarcodeRenderOptions(heightMm: number): BarcodeRenderOptions {
  if (heightMm <= 30) {
    return {
      height: 20,
      width: 0.8,
      fontSize: 7,
      textMargin: 1,
      storeFont: 6,
      productFont: 7,
      metaFont: 6,
      priceFont: 7,
      qrSize: 28,
    };
  }
  if (heightMm <= 40) {
    return {
      height: 32,
      width: 1,
      fontSize: 9,
      textMargin: 2,
      storeFont: 7,
      productFont: 8,
      metaFont: 7,
      priceFont: 8,
      qrSize: 48,
    };
  }
  return {
    height: 45,
    width: 1.2,
    fontSize: 11,
    textMargin: 2,
    storeFont: 8,
    productFont: 10,
    metaFont: 8,
    priceFont: 10,
    qrSize: 72,
  };
}

/** Thinner module width for long codes so bars stay scannable on thermal labels. */
export function getBarcodeModuleWidth(
  settings: LabelSettings,
  scancodeLength: number
): number {
  const dims = resolveLabelDimensions(settings);
  const base = dims.isThermal
    ? getBarcodeRenderOptions(dims.heightMm).width
    : 1.2;
  if (!dims.isThermal) {
    if (scancodeLength > 18) return Math.max(0.9, base * 0.75);
    if (scancodeLength > 14) return Math.max(1, base * 0.9);
    return base;
  }
  if (scancodeLength > 22) return Math.max(0.55, base * 0.7);
  if (scancodeLength > 16) return Math.max(0.65, base * 0.85);
  return base;
}

export function buildLabelPrintStyles(
  settings: LabelSettings,
  itemClass: string,
  layoutContext?: { storeName?: string }
): string {
  const dims = resolveLabelDimensions(settings);
  const render =
    dims.isThermal ? getBarcodeRenderOptions(dims.heightMm) : null;
  const isQrItem = itemClass.includes("qrcode");
  const qrLayout =
    dims.isThermal && isQrItem
      ? getQrLabelLayout(settings, { storeName: layoutContext?.storeName })
      : null;

  if (dims.isThermal && render) {
    return `
      @page {
        size: ${dims.pageCss};
        margin: 0;
      }
      * { box-sizing: border-box; }
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
      }
      .label-container {
        margin: 0;
        padding: 0;
      }
      .${itemClass} {
        width: ${dims.widthMm}mm;
        height: ${dims.heightMm}mm;
        padding: 1mm 1.5mm;
        overflow: hidden;
        text-align: center;
        page-break-after: always;
        page-break-inside: avoid;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1.1;
      }
      .${itemClass}:last-child {
        page-break-after: auto;
      }
      .${itemClass} .store-name {
        font-size: ${render.storeFont}px;
        color: #000;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .${itemClass} .product-name {
        font-size: ${render.productFont}px;
        font-weight: bold;
        color: #000;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .${itemClass} .variant,
      .${itemClass} .batch {
        font-size: ${render.metaFont}px;
        color: #374151;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .${itemClass} .barcode-svg {
        margin: 0 auto;
        padding: 0;
        width: auto;
        max-width: 100%;
        height: auto;
        max-height: ${render.height + 14}px;
        display: block;
      }
      .${itemClass} .qrcode-img {
        margin: 0 auto;
        padding: 0;
        flex-shrink: 0;
        width: ${qrLayout ? `${qrLayout.qrSizeMm}mm` : `${render.qrSize}px`};
        height: ${qrLayout ? `${qrLayout.qrSizeMm}mm` : `${render.qrSize}px`};
        max-width: calc(100% - 2mm);
        max-height: calc(100% - 2mm);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .${itemClass} .qrcode-img canvas,
      .${itemClass} .qrcode-img img {
        width: 100% !important;
        height: 100% !important;
        display: block;
      }
      .${itemClass} .qrcode-text {
        font-family: 'Courier New', monospace;
        font-size: ${Math.max(5, render.metaFont - 1)}px;
        color: #000;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .${itemClass} .price {
        font-size: ${render.priceFont}px;
        color: #000;
        font-weight: bold;
      }
      @media print {
        body { margin: 0; padding: 0; }
        .no-print { display: none; }
      }
    `;
  }

  return `
    @page {
      size: ${dims.pageCss};
      margin: 10mm;
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .label-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
      margin-bottom: 10px;
    }
    .${itemClass} {
      border: 1px solid #000;
      padding: 3px;
      text-align: center;
      page-break-inside: avoid;
      line-height: 1.2;
    }
    .${itemClass} .store-name {
      font-size: 10px;
      color: #000;
    }
    .${itemClass} .product-name {
      font-size: 12px;
      font-weight: bold;
      color: #000;
    }
    .${itemClass} .variant,
    .${itemClass} .batch {
      font-size: 10px;
      color: #374151;
    }
    .${itemClass} .barcode-svg {
      margin: 0 auto;
      padding: 0;
      width: auto;
      max-width: 100%;
      height: auto;
      max-height: 72px;
      display: block;
    }
    .${itemClass} .qrcode-img {
      margin: 0 auto;
      padding: 0;
      width: 100%;
      max-width: 120px;
      display: block;
    }
    .${itemClass} .qrcode-text {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      color: #000;
      margin-top: 2px;
    }
    .${itemClass} .price {
      font-size: 12px;
      color: #000;
      font-weight: bold;
    }
    @media print {
      .no-print { display: none; }
    }
  `;
}

export function getJsBarcodeOptions(
  settings: LabelSettings,
  scancode = ""
): Record<string, unknown> {
  const dims = resolveLabelDimensions(settings);
  const moduleWidth = getBarcodeModuleWidth(settings, scancode.length);
  if (dims.isThermal) {
    const opts = getBarcodeRenderOptions(dims.heightMm);
    return {
      format: "CODE128",
      width: moduleWidth,
      height: opts.height,
      displayValue: true,
      fontSize: opts.fontSize,
      textMargin: opts.textMargin,
      font: "Arial",
      margin: 2,
      marginTop: 1,
      marginBottom: 1,
    };
  }
  return {
    format: "CODE128",
    width: moduleWidth,
    height: 70,
    displayValue: true,
    fontSize: 14,
    textMargin: 2,
    font: "Arial",
    margin: 4,
  };
}

export function getQrRenderSize(
  settings: LabelSettings,
  context?: { storeName?: string; scancodeLength?: number }
): number {
  return getQrLabelLayout(settings, context).qrSizePx;
}

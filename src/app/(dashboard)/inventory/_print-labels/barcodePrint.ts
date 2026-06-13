import {
  buildLabelPrintStyles,
  escapeHtml,
  getJsBarcodeOptions,
} from "./labelLayout";
import { printHtmlInFrame } from "./printFrame";
import type { LabelPreview } from "./types";

function generateBarcodeHTML(preview: LabelPreview): string {
  const { items, settings, storeName } = preview;
  const styles = buildLabelPrintStyles(settings, "barcode-item");
  const barcodeOptionsByIndex = items.map((item) =>
    getJsBarcodeOptions(settings, item.scancode)
  );

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Barcodes</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="label-container">
  `;

  html += `
    <script>
      const items = ${JSON.stringify(items)};
      const barcodeOptionsByIndex = ${JSON.stringify(barcodeOptionsByIndex)};

      function generateBarcodes() {
        if (window.JsBarcode) {
          items.forEach((item, index) => {
            const svgId = 'barcode-svg-' + index;
            const svgElement = document.getElementById(svgId);
            if (svgElement) {
              try {
                const opts = barcodeOptionsByIndex[index] || barcodeOptionsByIndex[0] || {};
                window.JsBarcode(svgElement, item.scancode, opts);
              } catch (error) {
                console.error('Error generating barcode:', error);
              }
            }
          });
          return true;
        }
        return false;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
      script.onload = function() {
        setTimeout(generateBarcodes, 100);
      };
      script.onerror = function() {
        console.error('Failed to load JsBarcode script');
      };
      document.head.appendChild(script);

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(generateBarcodes, 200);
        });
      } else {
        setTimeout(generateBarcodes, 200);
      }
    </script>
  `;

  items.forEach((item, index) => {
    html += '<div class="barcode-item">';

    if (settings.showStoreName && storeName) {
      html += `<div class="store-name">${escapeHtml(storeName)}</div>`;
    }

    if (settings.showProductName && item.productName) {
      html += `<div class="product-name">${escapeHtml(item.productName)}</div>`;
    }

    if (settings.showVariant && item.variant) {
      html += `<div class="variant">${escapeHtml(item.variant)}</div>`;
    }

    if (settings.showBatch) {
      html += `<div class="batch">Batch: ${escapeHtml(item.batchNumber)}</div>`;
    }

    html += `<svg id="barcode-svg-${index}" class="barcode-svg"></svg>`;

    if (settings.showPrice && item.price != null) {
      html += `<div class="price">৳${Number(item.price).toFixed(2)}</div>`;
    }

    html += "</div>";
  });

  html += `
      </div>
    </body>
    </html>
  `;

  return html;
}

export function printBarcodeSheet(preview: LabelPreview) {
  printHtmlInFrame(generateBarcodeHTML(preview));
}

import { buildLabelPrintStyles, escapeHtml, getQrRenderSize } from "./labelLayout";
import { printHtmlInFrame } from "./printFrame";
import type { LabelPreview } from "./types";

function generateQrCodeHTML(preview: LabelPreview): string {
  const { items, settings, storeName } = preview;
  const qrSize = getQrRenderSize(settings);
  const styles = buildLabelPrintStyles(settings, "qrcode-item");

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print QR Codes</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="label-container">
  `;

  html += `
    <script>
      const items = ${JSON.stringify(items)};
      const qrSize = ${qrSize};

      function generateQRCodes() {
        if (window.QRCode) {
          items.forEach((item, index) => {
            const qrId = 'qrcode-' + index;
            const qrElement = document.getElementById(qrId);
            if (qrElement && !qrElement.querySelector('canvas')) {
              try {
                new window.QRCode(qrElement, {
                  text: item.scancode,
                  width: qrSize,
                  height: qrSize,
                  colorDark: '#000000',
                  colorLight: '#ffffff',
                  correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.H : 2
                });
              } catch (error) {
                console.error('Error generating QR code:', error);
              }
            }
          });
          return true;
        }
        return false;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = function() {
        setTimeout(generateQRCodes, 100);
      };
      script.onerror = function() {
        console.error('Failed to load QRCode.js script');
      };
      document.head.appendChild(script);

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(generateQRCodes, 200);
        });
      } else {
        setTimeout(generateQRCodes, 200);
      }
    </script>
  `;

  items.forEach((item, index) => {
    html += '<div class="qrcode-item">';

    if (settings.showStoreName && storeName) {
      html += `<div class="store-name">${escapeHtml(storeName)}</div>`;
    }

    if (settings.showProductName) {
      html += `<div class="product-name">${escapeHtml(item.productName)}</div>`;
    }

    if (settings.showVariant && item.variant) {
      html += `<div class="variant">${escapeHtml(item.variant)}</div>`;
    }

    if (settings.showBatch) {
      html += `<div class="batch">Batch: ${escapeHtml(item.batchNumber)}</div>`;
    }

    html += `<div id="qrcode-${index}" class="qrcode-img"></div>`;
    html += `<div class="qrcode-text">${escapeHtml(item.scancode)}</div>`;

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

export function printQrSheet(preview: LabelPreview) {
  printHtmlInFrame(generateQrCodeHTML(preview));
}

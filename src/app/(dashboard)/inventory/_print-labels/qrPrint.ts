import type { LabelPreview } from "./types";

function generateQrCodeHTML(preview: LabelPreview): string {
  const { items, settings, storeName } = preview;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print QR Codes</title>
      <style>
        @page {
          size: ${settings.paperSize};
          margin: 10mm;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
        }
        .qrcode-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .qrcode-item {
          border: 1px solid #000;
          padding: 3px;
          text-align: center;
          page-break-inside: avoid;
          line-height: 1.2;
        }
        .qrcode-item .store-name {
          font-size: 10px;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #000;
        }
        .qrcode-item .product-name {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #000;
        }
        .qrcode-item .variant {
          font-size: 10px;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #374151;
        }
        .qrcode-item .batch {
          font-size: 10px;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #374151;
        }
        .qrcode-item .qrcode-img {
          margin: 0px auto;
          padding: 0px;
          width: 100%;
          max-width: 120px;
          display: block;
        }
        .qrcode-item .qrcode-text {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: #000;
          margin-top: 2px;
        }
        .qrcode-item .price {
          font-size: 12px;
          margin-top: 0px;
          padding-top: 1px;
          color: #000;
          font-weight: bold;
        }
        @media print {
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="qrcode-container">
  `;

  html += `
    <script>
      const items = ${JSON.stringify(items)};

      function generateQRCodes() {
        if (window.QRCode) {
          items.forEach((item, index) => {
            const qrId = 'qrcode-' + index;
            const qrElement = document.getElementById(qrId);
            if (qrElement && !qrElement.querySelector('canvas')) {
              try {
                new window.QRCode(qrElement, {
                  text: item.scancode,
                  width: 120,
                  height: 120,
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
        setTimeout(function() {
          generateQRCodes();
        }, 100);
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
      html += `<div class="store-name">${storeName}</div>`;
    }

    if (settings.showProductName) {
      html += `<div class="product-name">${item.productName}</div>`;
    }

    if (settings.showVariant && item.variant) {
      html += `<div class="variant">${item.variant}</div>`;
    }

    if (settings.showBatch) {
      html += `<div class="batch">Batch: ${item.batchNumber}</div>`;
    }

    html += `<div id="qrcode-${index}" class="qrcode-img"></div>`;
    html += `<div class="qrcode-text">${item.scancode}</div>`;

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
  const html = generateQrCodeHTML(preview);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  let printCalled = false;

  const triggerPrint = () => {
    if (printCalled) return;
    printCalled = true;
    setTimeout(() => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 1500);
    }, 200);
  };

  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    iframe.onload = () => {
      triggerPrint();
    };
    setTimeout(() => {
      if (iframeDoc.readyState === "complete" && !printCalled) {
        triggerPrint();
      }
    }, 1000);
  }
}

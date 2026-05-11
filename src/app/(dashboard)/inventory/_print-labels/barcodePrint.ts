import type { LabelPreview } from "./types";

function generateBarcodeHTML(preview: LabelPreview): string {
  const { items, settings, storeName } = preview;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Barcodes</title>
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
        .barcode-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .barcode-item {
          border: 1px solid #000;
          padding: 3px;
          text-align: center;
          page-break-inside: avoid;
          line-height: 1.2;
        }
        .barcode-item .store-name {
          font-size: 10px;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #000;
        }
        .barcode-item .product-name {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #000;
        }
        .barcode-item .variant {
          font-size: 10px;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #374151;
        }
        .barcode-item .batch {
          font-size: 10px;
          margin-bottom: 0px;
          padding-bottom: 1px;
          color: #374151;
        }
        .barcode-item .barcode-svg {
          margin: 0px;
          padding: 0px;
          width: 100%;
          height: 70px;
          display: block;
        }
        .barcode-item .price {
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
      <div class="barcode-container">
  `;

  html += `
    <script>
      const items = ${JSON.stringify(items)};

      function generateBarcodes() {
        if (window.JsBarcode) {
          items.forEach((item, index) => {
            const svgId = 'barcode-svg-' + index;
            const svgElement = document.getElementById(svgId);
            if (svgElement) {
              try {
                window.JsBarcode(svgElement, item.scancode, {
                  format: 'CODE128',
                  width: 2,
                  height: 70,
                  displayValue: true,
                  fontSize: 14,
                  textMargin: 3,
                  font: 'Arial',
                });
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
        setTimeout(function() {
          generateBarcodes();
        }, 100);
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
  const html = generateBarcodeHTML(preview);
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

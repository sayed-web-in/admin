import { formatDateTimeMedShort } from "@/lib/utils";

export interface InvoiceItemPrint {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountValue?: number;
  discountType?: string;
  total: number;
  imeiNumbers?: string[];
  attributeValues?: string[];
}

export interface InvoiceBranding {
  brandName?: string;
  /** Absolute URL for print / iframe (use resolveMediaUrl). */
  logoUrl?: string;
}

export interface InvoicePrintData {
  invoiceNo: string;
  orderNo: string;
  date: string;
  branchName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItemPrint[];
  subtotal?: number;
  discountAmount: number;
  taxAmount: number;
  shippingCost: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  previousDue?: number;
  paymentStatus: string;
  paymentMethod?: string;
  receivedAmount?: number;
  changeAmount?: number;
}

function escapeHtml(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function asNum(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function formatCurrencyBasic(amount: number): string {
  if (isNaN(amount)) return "৳0";
  const s = amount
    .toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    .replace(/\.00$/, "");
  return `৳${s}`;
}

function buildImeiBlockHtml(imeiNumbers: string[] | undefined): string {
  if (!imeiNumbers?.length) return "";
  const list = imeiNumbers.map((n) => String(n).trim()).filter(Boolean);
  if (!list.length) return "";
  const valuesHtml = list.map((n) => escapeHtml(n)).join(", ");
  return `<div class="imei-block"><div class="imei-line"><span class="imei-label">IMEI / Serial</span><span class="imei-values">${valuesHtml}</span></div></div>`;
}

function buildInvoiceTopBranding(branding?: InvoiceBranding): string {
  const logoUrl = branding?.logoUrl?.trim();
  const brandName = branding?.brandName?.trim();
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName || "Store logo")}" class="brand-logo" />`
    : brandName
      ? `<div class="brand-name-text">${escapeHtml(brandName)}</div>`
      : "";
  const nameUnderLogo =
    logoUrl && brandName
      ? `<div class="brand-name-under-logo">${escapeHtml(brandName)}</div>`
      : "";

  return `
    <div class="invoice-hero">
      ${logoBlock ? `<div class="logo-wrap">${logoBlock}</div>` : ""}
      ${nameUnderLogo}
      <div class="invoice-title">Invoice</div>
      <div class="invoice-tagline">Sales memo</div>
    </div>
  `;
}

export function invoicePayloadToPrintData(raw: unknown): InvoicePrintData {
  if (!raw || typeof raw !== "object") {
    return {
      invoiceNo: "",
      orderNo: "",
      date: new Date().toISOString(),
      items: [],
      discountAmount: 0,
      taxAmount: 0,
      shippingCost: 0,
      grandTotal: 0,
      paidAmount: 0,
      dueAmount: 0,
      previousDue: 0,
      paymentStatus: "due",
    };
  }
  const r = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items: InvoiceItemPrint[] = itemsRaw.map((it: Record<string, unknown>) => {
    const serialNumbers = Array.isArray(it.serialNumbers) ? it.serialNumbers.map(String) : [];
    const imeiNumbers = Array.isArray(it.imeiNumbers) ? it.imeiNumbers.map(String) : [];
    const attrList: string[] = Array.isArray(it.attributeValues)
      ? it.attributeValues.map(String).filter(Boolean)
      : [];
    return {
      productName: String(it.productName ?? "—"),
      sku: String(it.sku ?? "—"),
      quantity: asNum(it.quantity, 0),
      unitPrice: asNum(it.unitPrice, 0),
      discountValue: it.discountValue !== undefined ? asNum(it.discountValue, 0) : undefined,
      discountType: typeof it.discountType === "string" ? it.discountType : undefined,
      total: asNum(it.total ?? it.totalPrice, 0),
      imeiNumbers: imeiNumbers.length > 0 ? imeiNumbers : serialNumbers.length > 0 ? serialNumbers : undefined,
      attributeValues: attrList.length ? attrList : undefined,
    };
  });
  const subtotal =
    r.subtotal !== undefined && r.subtotal !== null
      ? asNum(r.subtotal, 0)
      : items.reduce((s, i) => s + i.total, 0);

  return {
    invoiceNo: String(r.invoiceNo ?? ""),
    orderNo: String(r.orderNo ?? ""),
    date: String(r.date ?? new Date().toISOString()),
    branchName: typeof r.branchName === "string" ? r.branchName : undefined,
    customerName: typeof r.customerName === "string" ? r.customerName : undefined,
    customerPhone: typeof r.customerPhone === "string" ? r.customerPhone : undefined,
    customerAddress: typeof r.customerAddress === "string" ? r.customerAddress : undefined,
    items,
    subtotal,
    discountAmount: asNum(r.discountAmount, 0),
    taxAmount: asNum(r.taxAmount, 0),
    shippingCost: asNum(r.shippingCost, 0),
    grandTotal: asNum(r.grandTotal, 0),
    paidAmount: asNum(r.paidAmount, 0),
    dueAmount: asNum(r.dueAmount, 0),
    previousDue: r.previousDue !== undefined ? asNum(r.previousDue, 0) : 0,
    paymentStatus: String(r.paymentStatus ?? "due"),
    paymentMethod: typeof r.paymentMethod === "string" ? r.paymentMethod : undefined,
    receivedAmount: r.receivedAmount !== undefined ? asNum(r.receivedAmount, 0) : undefined,
    changeAmount: r.changeAmount !== undefined ? asNum(r.changeAmount, 0) : undefined,
  };
}

export function buildInvoicePrintDocumentHtml(
  invoice: InvoicePrintData,
  branding?: InvoiceBranding
): string {
  const itemsRows = invoice.items
    .map(
      (item) => `<tr>
  <td>
    <div>
      <div class="item-name-wrap"><span class="item-name-bold">${escapeHtml(item.productName)}</span>${item.attributeValues && item.attributeValues.length > 0 ? ` <span class="attr-values">(${item.attributeValues.map((v) => escapeHtml(v)).join(", ")})</span>` : ""}</div>
      ${!(item.imeiNumbers && item.imeiNumbers.length > 0) ? `<div class="sku">SKU: ${escapeHtml(item.sku)}</div>` : ""}
      ${buildImeiBlockHtml(item.imeiNumbers)}
    </div>
  </td>
  <td class="text-right cell-num">${item.quantity}</td>
  <td class="text-right cell-num">${formatCurrencyBasic(item.unitPrice)}</td>
  <td class="text-right cell-total">${formatCurrencyBasic(item.total)}</td>
</tr>`
    )
    .join("");

  const summaryLines: string[] = [];
  summaryLines.push(
    `<div class="row-line"><span>Subtotal:</span><span>${formatCurrencyBasic(invoice.subtotal || 0)}</span></div>`
  );
  if (invoice.discountAmount > 0) {
    summaryLines.push(
      `<div class="row-line"><span>Discount:</span><span class="neg">-${formatCurrencyBasic(invoice.discountAmount)}</span></div>`
    );
  }
  if (invoice.taxAmount > 0) {
    summaryLines.push(
      `<div class="row-line"><span>Tax:</span><span>${formatCurrencyBasic(invoice.taxAmount)}</span></div>`
    );
  }
  if (invoice.shippingCost > 0) {
    summaryLines.push(
      `<div class="row-line"><span>Shipping:</span><span>${formatCurrencyBasic(invoice.shippingCost)}</span></div>`
    );
  }
  summaryLines.push(
    `<div class="row-line total"><span>Grand Total:</span><span>${formatCurrencyBasic(invoice.grandTotal)}</span></div>`
  );
  summaryLines.push(
    `<div class="row-line"><span>Paid:</span><span>${formatCurrencyBasic(invoice.paidAmount)}</span></div>`
  );
  if (invoice.receivedAmount != null) {
    summaryLines.push(
      `<div class="row-line"><span>Received:</span><span>${formatCurrencyBasic(invoice.receivedAmount)}</span></div>`
    );
  }
  if (invoice.changeAmount != null && invoice.changeAmount > 0) {
    summaryLines.push(
      `<div class="row-line"><span>Change:</span><span>${formatCurrencyBasic(invoice.changeAmount)}</span></div>`
    );
  }
  if (invoice.dueAmount > 0) {
    summaryLines.push(
      `<div class="row-line"><span>Due Amount:</span><span class="due">${formatCurrencyBasic(invoice.dueAmount)}</span></div>`
    );
  }
  if ((invoice.previousDue || 0) > 0) {
    summaryLines.push(
      `<div class="row-line"><span>Previous Due:</span><span class="due">${formatCurrencyBasic(invoice.previousDue || 0)}</span></div>`
    );
    summaryLines.push(
      `<div class="row-line total"><span>Total Due:</span><span class="due">${formatCurrencyBasic((invoice.previousDue || 0) + (invoice.dueAmount || 0))}</span></div>`
    );
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo || "Invoice")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Noto Sans Bengali', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.45;
      margin: 0;
      padding: 16px;
      color: #111827;
      background: #ffffff;
    }
    .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 0; background: #ffffff; }
    .invoice-hero {
      text-align: center;
      padding: 8px 0 14px;
      margin-bottom: 12px;
      border-bottom: 2px solid #111827;
    }
    .logo-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 8px;
      min-height: 44px;
    }
    .brand-logo {
      max-height: 56px;
      max-width: 220px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }
    .brand-name-text {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #111827;
      text-transform: uppercase;
    }
    .brand-name-under-logo {
      font-size: 12px;
      font-weight: 600;
      color: #4b5563;
      margin-bottom: 6px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #111827;
      margin: 2px 0 4px;
    }
    .invoice-tagline {
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .meta-strip {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      flex-wrap: wrap;
      padding: 10px 0 12px;
      margin-bottom: 4px;
      border-bottom: 1px solid #e5e7eb;
    }
    .meta-strip-left,
    .meta-strip-right {
      font-size: 12px;
      line-height: 1.5;
    }
    .meta-strip-right { text-align: right; margin-left: auto; }
    .meta-label { color: #6b7280; font-weight: 600; }
    .meta-value { font-weight: 700; color: #111827; }
    .branch-pill {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 10px;
      border-radius: 999px;
      background: #f3f4f6;
      font-size: 11px;
      font-weight: 600;
      color: #374151;
    }
    .two-col { display: flex; gap: 24px; margin-top: 14px; margin-bottom: 14px; }
    .two-col > div { flex: 1; font-size: 13px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .barcode-block { text-align: center; margin: 12px 0 14px; }
    .barcode-number {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: #111827;
      margin-top: 4px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th {
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      border-bottom: 2px solid #d1d5db;
      background: #f9fafb;
    }
    .text-right { text-align: right; }
    .cell-num { font-weight: 600; color: #374151; }
    .cell-total { font-weight: 700; color: #111827; }
    .item-name-wrap { margin-bottom: 2px; }
    .item-name-bold { font-weight: 700; }
    .attr-values { font-size: 10px; color: #6b7280; font-weight: 500; }
    .sku { font-size: 10px; color: #6b7280; margin-top: 2px; }
    .imei-block { margin-top: 6px; max-width: 100%; }
    .imei-line { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: flex-start; gap: 6px 10px; width: 100%; }
    .imei-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; flex-shrink: 0; }
    .imei-values { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; line-height: 1.45; color: #111827; text-align: left; word-break: break-all; min-width: 0; }
    .summary {
      width: 280px;
      margin-left: auto;
      font-size: 12px;
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fafafa;
    }
    .row-line { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .row-line > span:first-child { font-weight: 600; color: #4b5563; }
    .row-line > span:last-child { font-weight: 700; color: #111827; }
    .row-line.total span:first-child { font-weight: 700; color: #111827; }
    .row-line.total span:last-child { font-size: 15px; font-weight: 800; color: #111827; }
    .neg { color: #dc2626 !important; }
    .due { color: #b45309 !important; }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
      text-align: center;
    }
    @media print {
      body { margin: 0; padding: 0; background: #ffffff; }
      .page { margin: 0; padding: 0; width: auto; max-width: none; }
      .two-col { flex-direction: row; }
      .meta-strip-right { text-align: right; }
      .summary { width: 280px; max-width: none; margin-left: auto; margin-right: 0; }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>
<body>
  <div class="page">
    ${buildInvoiceTopBranding(branding)}
    <div class="meta-strip">
      <div class="meta-strip-left">
        ${invoice.branchName ? `<div class="branch-pill">Branch: ${escapeHtml(invoice.branchName)}</div>` : ""}
      </div>
      <div class="meta-strip-right">
        <div><span class="meta-label">Invoice No:</span> <span class="meta-value">${escapeHtml(invoice.invoiceNo)}</span></div>
        <div><span class="meta-label">Order No:</span> <span class="meta-value">${escapeHtml(invoice.orderNo)}</span></div>
        <div><span class="meta-label">Date:</span> <span class="meta-value">${escapeHtml(formatDateTimeMedShort(invoice.date))}</span></div>
      </div>
    </div>
    <div class="two-col">
      <div>
        <div class="section-title">Bill To</div>
        <div><strong>${escapeHtml(invoice.customerName || "Walk-in Customer")}</strong></div>
        ${invoice.customerPhone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">Phone: ${escapeHtml(invoice.customerPhone)}</div>` : ""}
        ${invoice.customerAddress ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${escapeHtml(invoice.customerAddress)}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div class="section-title">Payment Details</div>
        ${invoice.paymentMethod ? `<div style="font-size:12px"><span class="meta-label">Method:</span> <strong>${escapeHtml(invoice.paymentMethod)}</strong></div>` : ""}
        <div style="font-size:12px"><span class="meta-label">Status:</span> <strong>${escapeHtml(invoice.paymentStatus)}</strong></div>
      </div>
    </div>
    <div class="barcode-block">
      <svg id="invoice-barcode" class="barcode" data-code="${escapeHtml(invoice.invoiceNo || invoice.orderNo)}"></svg>
      <div class="barcode-number">${escapeHtml(invoice.invoiceNo || invoice.orderNo)}</div>
    </div>
    <div>
      <div class="section-title">Items</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </div>
    <div class="summary">${summaryLines.join("")}</div>
    <div class="footer"><div>Thank you for your business.</div></div>
  </div>
  <script>
    window.addEventListener('load', function () {
      try {
        var el = document.getElementById('invoice-barcode');
        if (el && window.JsBarcode) {
          var code = el.getAttribute('data-code') || '';
          if (code) {
            window.JsBarcode(el, code, {
              format: 'CODE128',
              displayValue: false,
              margin: 0,
              height: 52,
              width: 1.2
            });
          }
        }
      } catch (e) {}
    });
  </script>
</body>
</html>`;
}

export async function printInvoiceHtml(
  invoice: unknown,
  branding?: InvoiceBranding
) {
  const data = invoicePayloadToPrintData(invoice);
  let resolvedBranding = branding;
  if (!resolvedBranding && typeof window !== "undefined") {
    const { fetchInvoiceBranding } = await import("@/lib/invoice-branding");
    resolvedBranding = await fetchInvoiceBranding();
  }
  const html = buildInvoicePrintDocumentHtml(data, resolvedBranding);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  const trigger = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 800);
  };
  iframe.onload = () => setTimeout(trigger, 300);
}

"use client";

import { QrCode } from "lucide-react";
import { PrintLabelPage } from "../_print-labels/PrintLabelPage";

export default function QRCodePage() {
  return (
    <PrintLabelPage
      kind="qrcode"
      title="Print QR code"
      description="Pick branch and product, add batches to the list, then preview and print (same fields as seller admin)."
      icon={QrCode}
    />
  );
}

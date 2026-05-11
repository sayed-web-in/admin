"use client";

import { Barcode } from "lucide-react";
import { PrintLabelPage } from "../_print-labels/PrintLabelPage";

export default function BarcodePage() {
  return (
    <PrintLabelPage
      kind="barcode"
      title="Print barcode"
      description="Pick branch and product, add batches to the list, then preview and print (same fields as seller admin)."
      icon={Barcode}
    />
  );
}

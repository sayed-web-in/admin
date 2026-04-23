"use client";

import { useMemo } from "react";
import { CheckCircle, Download, FileText, Printer } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import {
  buildInvoicePrintDocumentHtml,
  invoicePayloadToPrintData,
  printInvoiceHtml,
} from "@/lib/invoice-print";

interface InvoicePreviewModalProps {
  open: boolean;
  invoiceData: unknown;
  onOpenChange: (open: boolean) => void;
}

export function InvoicePreviewModal({ open, invoiceData, onOpenChange }: InvoicePreviewModalProps) {
  const previewHtml = useMemo(() => {
    if (!invoiceData) return "";
    const payload = invoicePayloadToPrintData(invoiceData);
    return buildInvoicePrintDocumentHtml(payload);
  }, [invoiceData]);

  if (!open || !invoiceData) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Invoice"
      description="Preview matches print output"
      icon={<FileText className="w-5 h-5" />}
      className="max-w-4xl"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!previewHtml) return;
              const w = window.open("", "_blank");
              if (!w) return;
              w.document.open();
              w.document.write(previewHtml);
              w.document.close();
            }}
          >
            <Download className="mr-1 h-4 w-4" />
            Open for PDF
          </Button>
          <Button variant="outline" onClick={() => printInvoiceHtml(invoiceData)}>
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            <CheckCircle className="mr-1 h-4 w-4" />
            Done
          </Button>
        </div>
      }
    >
      <div className="mx-auto h-[72vh] w-full max-w-[860px] rounded-md border border-slate-200 bg-white">
        <iframe
          title="Invoice preview"
          className="h-full w-full border-0"
          srcDoc={previewHtml}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </Modal>
  );
}

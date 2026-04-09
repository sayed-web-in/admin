"use client";

import { useEffect, useState } from "react";
import { Eye, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { Modal } from "@/components/common/Modal";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Batch {
  id: number;
  batchNumber: string;
  barcode: string;
  availableQty: number;
  soldQty: number;
  returnQty: number;
  purchaseCost: number;
  imeiQty: number;
  date: string;
  type: string;
}

interface BatchDetail {
  batchNumber: string;
  barcode: string;
  type: string;
  initialQty: number;
  availableQty: number;
  soldQty: number;
  purchaseCost: number;
  totalCost: number;
  batchDate: string;
  supplier?: { name: string; phone?: string; email?: string };
  serialNumbers?: { serial: string; status: string }[];
}

interface BatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchProductVariantId: number | null;
}

export function BatchModal({
  open,
  onOpenChange,
  branchProductVariantId,
}: BatchModalProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (open && branchProductVariantId) {
      setDetail(null);
      setLoading(true);
      apiFetch<{ batches: Batch[] }>(
        `/products/branch-variants/${branchProductVariantId}/batches`
      )
        .then((d) => setBatches(d.batches || []))
        .catch(() => setBatches([]))
        .finally(() => setLoading(false));
    }
  }, [open, branchProductVariantId]);

  const viewBatch = async (batchId: number) => {
    setDetailLoading(true);
    try {
      const data = await apiFetch<{ batch: BatchDetail }>(
        `/products/batches/${batchId}`
      );
      setDetail(data.batch);
    } catch {
      alert("Failed to load batch details");
    } finally {
      setDetailLoading(false);
    }
  };

  const batchColumns = [
    {
      key: "index",
      label: "#",
      className: "w-10",
      render: (_: Batch, i: number) => i + 1,
    },
    { key: "batchNumber", label: "Batch #" },
    { key: "barcode", label: "Barcode" },
    { key: "availableQty", label: "Available" },
    { key: "soldQty", label: "Sold" },
    { key: "returnQty", label: "Returned" },
    {
      key: "purchaseCost",
      label: "Purchase Cost",
      render: (item: Batch) => formatPrice(item.purchaseCost),
    },
    { key: "imeiQty", label: "IMEI Qty" },
    {
      key: "date",
      label: "Date",
      render: (item: Batch) => formatDate(item.date),
    },
    { key: "type", label: "Type" },
    {
      key: "actions",
      label: "Action",
      render: (item: Batch) => (
        <Button variant="ghost" size="sm" onClick={() => viewBatch(item.id)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? "Batch Details" : "Batch List"}
      className="max-w-4xl"
    >
      {detailLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : detail ? (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetail(null)}
            className="mb-2"
          >
            <ArrowLeft size={14} className="mr-1" /> Back to list
          </Button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Batch Number:</span>{" "}
              <span className="font-medium">{detail.batchNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Barcode:</span>{" "}
              <span className="font-medium">{detail.barcode}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="font-medium">{detail.type}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Initial Qty:</span>{" "}
              <span className="font-medium">{detail.initialQty}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Available Qty:</span>{" "}
              <span className="font-medium">{detail.availableQty}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sold Qty:</span>{" "}
              <span className="font-medium">{detail.soldQty}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Purchase Cost:</span>{" "}
              <span className="font-medium">
                {formatPrice(detail.purchaseCost)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Cost:</span>{" "}
              <span className="font-medium">
                {formatPrice(detail.totalCost)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Batch Date:</span>{" "}
              <span className="font-medium">
                {formatDate(detail.batchDate)}
              </span>
            </div>
          </div>

          {detail.supplier && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Supplier</p>
              <p>{detail.supplier.name}</p>
              {detail.supplier.phone && <p>{detail.supplier.phone}</p>}
              {detail.supplier.email && <p>{detail.supplier.email}</p>}
            </div>
          )}

          {detail.serialNumbers && detail.serialNumbers.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-2">Serial Numbers</p>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 px-2 text-xs text-muted-foreground">
                        Serial
                      </th>
                      <th className="text-left py-1.5 px-2 text-xs text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.serialNumbers.map((sn, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-1.5 px-2 font-mono">{sn.serial}</td>
                        <td className="py-1.5 px-2">
                          <Badge
                            variant={
                              sn.status === "in_stock" ? "success" : "secondary"
                            }
                          >
                            {sn.status === "in_stock" ? "In Stock" : "Sold"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <DataTable columns={batchColumns} data={batches} loading={loading} />
      )}
    </Modal>
  );
}

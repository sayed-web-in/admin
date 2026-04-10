"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Barcode,
  Calendar,
  CheckCircle,
  FileText,
  Hash,
  Package,
  PackageOpen,
  ShoppingCart,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BatchDetailNormalized,
  FieldCard,
  batchStatusLabel,
  fieldCardClass,
  formatBatchType,
  labelClass,
  normalizeDetailBatch,
  serialStatusBadgeVariant,
  serialStatusLabel,
  valueClass,
} from "@/components/inventory/batch-modals-shared";
import { cn, formatDateDDMMYYYY, formatPrice } from "@/lib/utils";

export interface BatchDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: number | null;
}

export function BatchDetailModal({
  open,
  onOpenChange,
  batchId,
}: BatchDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<BatchDetailNormalized | null>(null);

  useEffect(() => {
    if (!open || batchId == null) {
      setBatch(null);
      return;
    }
    setLoading(true);
    apiFetch<{ batch: Record<string, unknown> }>(`/products/batches/${batchId}`)
      .then((res) => setBatch(normalizeDetailBatch(res.batch)))
      .catch(() => setBatch(null))
      .finally(() => setLoading(false));
  }, [open, batchId]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Batch details"
      icon={<FileText className="h-5 w-5" aria-hidden />}
      size="md"
      footer={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-xl sm:ml-auto sm:w-auto"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden
          />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      ) : !batch ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Batch not found.
        </div>
      ) : (
        <div className="space-y-2">
          <FieldCard
            label="Batch number"
            value={<span className="font-mono">{batch.batchNumber}</span>}
            icon={<Hash className="h-4 w-4" />}
          />
          <FieldCard
            label="Barcode"
            value={<span className="font-mono">{batch.barcode || "—"}</span>}
            icon={<Barcode className="h-4 w-4" />}
          />
          <FieldCard
            label="Batch type"
            value={formatBatchType(batch.type)}
            icon={<Package className="h-4 w-4" />}
          />
          <FieldCard
            label="Status"
            value={batchStatusLabel(batch)}
            icon={<CheckCircle className="h-4 w-4" />}
          />
          <FieldCard
            label="Initial quantity"
            value={batch.initialQty}
            icon={<PackageOpen className="h-4 w-4" />}
          />
          <FieldCard
            label="Available quantity"
            value={batch.availableQty}
            valueHighlight="emerald"
            icon={<PackageOpen className="h-4 w-4" />}
          />
          <FieldCard
            label="Sold quantity"
            value={batch.soldQty}
            valueHighlight="primary"
            icon={<ShoppingCart className="h-4 w-4" />}
          />
          <FieldCard
            label="Returned qty"
            value={batch.returnQty}
            icon={<PackageOpen className="h-4 w-4" />}
          />
          <FieldCard
            label="Purchase cost (per unit)"
            value={
              batch.purchaseCost > 0 ? formatPrice(batch.purchaseCost) : "—"
            }
            icon={<Banknote className="h-4 w-4" />}
          />
          <FieldCard
            label="Total cost"
            value={batch.totalCost > 0 ? formatPrice(batch.totalCost) : "—"}
            icon={<Banknote className="h-4 w-4" />}
          />
          <FieldCard
            label="Batch date"
            value={formatDateDDMMYYYY(batch.batchDate)}
            icon={<Calendar className="h-4 w-4" />}
          />

          {batch.supplier && (
            <>
              <p className="flex items-center gap-1.5 pb-0.5 pt-1.5 text-xs font-semibold text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Supplier
              </p>
              <div className={fieldCardClass}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-sm">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div>
                    <p className={labelClass}>Name</p>
                    <p className={valueClass}>{batch.supplier.name}</p>
                  </div>
                  {batch.supplier.phone ? (
                    <div>
                      <p className={labelClass}>Phone</p>
                      <p className={valueClass}>{batch.supplier.phone}</p>
                    </div>
                  ) : null}
                  {batch.supplier.email ? (
                    <div>
                      <p className={labelClass}>Email</p>
                      <p className={valueClass}>{batch.supplier.email}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {batch.serialNumbers.length > 0 ? (
            <>
              <p className="flex items-center gap-1.5 pb-0.5 pt-1.5 text-xs font-semibold text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                Serial / IMEI ({batch.serialNumbers.length})
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        #
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Serial / IMEI
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.serialNumbers.map((serial, index) => {
                      const slug = serialStatusLabel(serial.status);
                      return (
                        <tr
                          key={serial.id}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 font-mono text-foreground">
                            {serial.serial}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={serialStatusBadgeVariant(serial.status)}
                            >
                              {slug.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {serial.createdAt
                              ? formatDateDDMMYYYY(serial.createdAt)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className={fieldCardClass}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-sm">
                <Hash className="h-4 w-4" />
              </div>
              <p className={cn(labelClass, "min-w-0 flex-1 py-0.5")}>
                No serial / IMEI numbers for this batch.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

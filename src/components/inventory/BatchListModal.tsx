"use client";

import { useEffect, useState } from "react";
import { Eye, Layers } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import {
  BatchListRow,
  formatBatchType,
  mapListBatches,
} from "@/components/inventory/batch-modals-shared";
import { formatDate, formatPrice } from "@/lib/utils";

export interface BatchListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeProductId: number | null;
  onViewDetails: (batchId: number) => void;
}

export function BatchListModal({
  open,
  onOpenChange,
  storeProductId,
  onViewDetails,
}: BatchListModalProps) {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<BatchListRow[]>([]);

  useEffect(() => {
    if (!open || !storeProductId) {
      setBatches([]);
      return;
    }
    setLoading(true);
    apiFetch<{ batches: Record<string, unknown>[] }>(
      `/products/store/${storeProductId}/batches`
    )
      .then((d) => setBatches(mapListBatches(d.batches || [])))
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, [open, storeProductId]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Batch list"
      description="Batches for this store listing. Open a row for full details."
      icon={<Layers className="h-5 w-5" aria-hidden />}
      size="xl"
      footer={
        <Button
          type="button"
          variant="outline"
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
          <span className="text-sm text-muted-foreground">
            Loading batches…
          </span>
        </div>
      ) : batches.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No batches found for this store listing.
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Total batches:{" "}
              <span className="font-semibold text-foreground">
                {batches.length}
              </span>
            </p>
          </div>
          <div className="w-full overflow-x-auto overflow-y-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="border-b-2 border-primary/20 bg-muted/50">
                <tr>
                  {(
                    [
                      "#",
                      "Batch number",
                      "Barcode",
                      "Avail. qty",
                      "Sold qty",
                      "Ret. qty",
                      "Pur. cost",
                      "Serial / IMEI",
                      "Date",
                      "Type",
                      "Action",
                    ] as const
                  ).map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((batch, index) => (
                  <tr
                    key={batch.id}
                    className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 align-middle text-[0.875rem] text-foreground">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem]">
                      <button
                        type="button"
                        onClick={() => onViewDetails(batch.id)}
                        className="cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-sm text-primary underline hover:text-primary/80"
                      >
                        {batch.batchNumber}
                      </button>
                    </td>
                    <td className="px-3 py-2 align-middle font-mono text-[0.875rem] text-muted-foreground">
                      {batch.barcode || "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem] text-muted-foreground">
                      {batch.availableQty}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem] text-muted-foreground">
                      {batch.soldQty}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem] text-muted-foreground">
                      {batch.returnQty}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem] text-muted-foreground">
                      {batch.purchaseCost > 0
                        ? formatPrice(batch.purchaseCost)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem] text-muted-foreground">
                      {batch.serialCount}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem] text-muted-foreground">
                      {batch.batchDate
                        ? formatDate(
                            typeof batch.batchDate === "string"
                              ? batch.batchDate
                              : new Date(batch.batchDate).toISOString(),
                          )
                        : "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem]">
                      <button
                        type="button"
                        onClick={() => onViewDetails(batch.id)}
                        className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm capitalize text-primary underline hover:text-primary/80"
                      >
                        {formatBatchType(batch.batchType)}
                      </button>
                    </td>
                    <td className="px-3 py-2 align-middle text-[0.875rem]">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1 rounded-lg"
                        onClick={() => onViewDetails(batch.id)}
                        title="View batch details"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

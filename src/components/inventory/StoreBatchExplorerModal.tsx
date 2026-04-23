"use client";

import { useCallback, useEffect, useState } from "react";
import { BatchDetailModal } from "@/components/inventory/BatchDetailModal";
import { BatchListModal } from "@/components/inventory/BatchListModal";

export interface StoreBatchExplorerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Store listing id (`storeProduct.id`) — same as branch row id in manage-product. */
  storeProductId: number | null;
}

/**
 * Seller-admin style: two separate dialogs — batch list and batch details stack on top.
 */
export function StoreBatchExplorerModal({
  open,
  onOpenChange,
  storeProductId,
}: StoreBatchExplorerModalProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);

  useEffect(() => {
    // When only the list dialog closes (e.g. while opening details),
    // keep detail modal state intact.
    if (!open && !detailOpen) {
      setDetailOpen(false);
      setDetailBatchId(null);
    }
  }, [open, detailOpen]);

  const handleListOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
    },
    [onOpenChange]
  );

  const handleViewDetails = useCallback((batchId: number) => {
    setDetailBatchId(batchId);
    setDetailOpen(true);
  }, []);

  const handleDetailOpenChange = useCallback((next: boolean) => {
    if (!next) setDetailBatchId(null);
    setDetailOpen(next);
  }, []);

  return (
    <>
      <BatchListModal
        open={open}
        onOpenChange={handleListOpenChange}
        storeProductId={storeProductId}
        onViewDetails={handleViewDetails}
      />
      <BatchDetailModal
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        batchId={detailBatchId}
      />
    </>
  );
}

export type { BatchDetailNormalized } from "@/components/inventory/batch-modals-shared";

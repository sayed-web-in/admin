"use client";

import { StoreBatchExplorerModal } from "@/components/inventory/StoreBatchExplorerModal";

export function BatchModal({
  open,
  onOpenChange,
  branchProductVariantId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchProductVariantId: number | null;
}) {
  return (
    <StoreBatchExplorerModal
      open={open}
      onOpenChange={onOpenChange}
      storeProductId={branchProductVariantId}
    />
  );
}

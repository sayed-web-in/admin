"use client";

import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

interface PosItem {
  storeProductId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
}

interface EditUnitPriceModalProps {
  open: boolean;
  item: PosItem | null;
  priceInput: string;
  onPriceInputChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditUnitPriceModal({
  open,
  item,
  priceInput,
  onPriceInputChange,
  onOpenChange,
  onSave,
}: EditUnitPriceModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit Unit Price" className="max-w-sm">
      {item && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Product: <span className="font-medium text-slate-900">{item.name}</span>
          </p>
          <p className="text-xs text-slate-500">
            Qty: <span className="font-semibold text-slate-900">{item.quantity}</span>
          </p>
          <input
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => onPriceInputChange(e.target.value.replace(/[^0-9.,]/g, ""))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {(() => {
            const parsed = parseFloat(priceInput.replace(/,/g, ""));
            const valid = !isNaN(parsed) && parsed >= 0;
            return valid ? (
              <p className="text-xs text-slate-500">
                New line total: <span className="font-semibold text-slate-900">{formatPrice(parsed * item.quantity)}</span>
              </p>
            ) : null;
          })()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>Save</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

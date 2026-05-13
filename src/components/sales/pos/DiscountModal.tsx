"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/common/Modal";

interface DiscountModalProps {
  open: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
}

export function DiscountModal({
  open,
  value,
  onValueChange,
  onOpenChange,
  onApply,
}: DiscountModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Discount" className="max-w-sm">
      <div className="space-y-3">
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Amount"
          className="w-full text-sm py-2.5 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onApply}>Apply</Button>
        </div>
      </div>
    </Modal>
  );
}

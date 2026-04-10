"use client";

import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  loading = false,
  destructive = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} className="max-w-md">
      <p className="text-sm text-muted-foreground mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          disabled={loading}
          onClick={async () => {
            await onConfirm();
          }}
        >
          {loading ? "…" : confirmText}
        </Button>
      </div>
    </Modal>
  );
}

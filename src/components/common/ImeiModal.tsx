"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";

interface ImeiModalProps {
  isOpen: boolean;
  onClose: () => void;
  quantity: number;
  currentSerials: string[];
  onConfirm: (serials: string[]) => void;
  title?: string;
  placeholder?: string;
  /** When true, user can confirm with 1 to quantity serials (e.g. returns) */
  allowPartial?: boolean;
  /** When provided, shows selectable list */
  availableSerials?: string[];
}

export default function ImeiModal({
  isOpen,
  onClose,
  quantity,
  currentSerials,
  onConfirm,
  title = "Add Serial/IMEI Numbers",
  placeholder = "Scan or type IMEI…",
  allowPartial = false,
  availableSerials = [],
}: ImeiModalProps) {
  const [imeiInput, setImeiInput] = useState("");
  const [serials, setSerials] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSerials([...currentSerials]);
      setImeiInput("");
    }
  }, [isOpen, currentSerials]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setImeiInput("");
      setSerials([...currentSerials]);
      onClose();
    }
  };

  const handleAddImei = () => {
    if (!imeiInput.trim()) return;
    const next = imeiInput.trim();
    if (serials.includes(next)) {
      toast.error("This IMEI/serial is already in the list.");
      return;
    }
    if (serials.length >= quantity) {
      toast.error(`Maximum ${quantity} IMEI/serial(s) allowed.`);
      return;
    }
    setSerials([...serials, next]);
    setImeiInput("");
  };

  const handleRemoveImei = (imei: string) => {
    setSerials(serials.filter((i) => i !== imei));
  };

  const toggleAvailableSerial = (sn: string) => {
    if (serials.includes(sn)) {
      setSerials(serials.filter((i) => i !== sn));
    } else if (serials.length < quantity) {
      setSerials([...serials, sn]);
    }
  };

  const handleConfirm = () => {
    if (allowPartial) {
      if (serials.length < 1 || serials.length > quantity) {
        toast.error(`Add 1 to ${quantity} IMEI/serial number(s).`);
        return;
      }
    } else if (serials.length !== quantity) {
      toast.error(`Add exactly ${quantity} IMEI/serial number(s).`);
      return;
    }
    onConfirm(serials);
    setImeiInput("");
    setSerials([...currentSerials]);
    onClose();
  };

  const canConfirm = allowPartial
    ? serials.length >= 1 && serials.length <= quantity
    : serials.length === quantity;

  const handleCancel = () => {
    setImeiInput("");
    setSerials([...currentSerials]);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={title}
      description={
        quantity > 0
          ? allowPartial
            ? `Add between 1 and ${quantity} unique IMEI/serial number(s).`
            : `Add exactly ${quantity} unique IMEI/serial number(s). Scan or type each one below.`
          : undefined
      }
      size="sm"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full rounded-xl sm:w-auto"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Confirm ({serials.length}/{quantity})
          </Button>
        </div>
      }
    >
      {availableSerials.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-foreground">
            Select IMEI/serial ({serials.length} selected)
          </h4>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {availableSerials.map((sn) => (
              <button
                key={sn}
                type="button"
                onClick={() => toggleAvailableSerial(sn)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  serials.includes(sn)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded border text-xs">
                  {serials.includes(sn) ? "✓" : ""}
                </span>
                <span className="font-mono">{sn}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-muted-foreground">
          Scan or enter IMEI/serial
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={imeiInput}
            onChange={(e) => setImeiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddImei();
              }
            }}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <Button
            type="button"
            size="icon"
            onClick={handleAddImei}
            aria-label="Add serial"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Added: {serials.length} / {quantity}
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium text-muted-foreground">
          Added IMEI/serial numbers
        </h4>
        {serials.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            None yet — scan or type above.
          </div>
        ) : (
          <div className="space-y-2">
            {serials.map((imei, index) => (
              <div
                key={`${imei}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="truncate font-mono text-sm text-foreground">
                    {imei}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImei(imei)}
                  className="shrink-0 rounded-lg p-1.5 text-destructive transition hover:bg-destructive/10"
                  aria-label="Remove serial"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { Hash } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ViewSerialNumbersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serials: { serial: string; status?: string }[];
  loading?: boolean;
}

export function ViewSerialNumbersModal({
  open,
  onOpenChange,
  serials,
  loading = false,
}: ViewSerialNumbersModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Serial / IMEI numbers"
      className="max-w-lg"
    >
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
        <Hash size={16} />
        <span>{loading ? "Loading…" : `${serials.length} serial(s)`}</span>
      </div>
      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading…</div>
      ) : serials.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No serial numbers for this listing.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-2 px-3 font-medium">Serial</th>
                <th className="text-left py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {serials.map((s, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2 px-3 font-mono text-xs">{s.serial}</td>
                  <td className="py-2 px-3">
                    <Badge variant={s.status === "IN_STOCK" ? "success" : "secondary"}>
                      {s.status === "IN_STOCK" ? "In stock" : s.status || "—"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end mt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

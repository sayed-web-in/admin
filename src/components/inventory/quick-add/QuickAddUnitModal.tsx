"use client";

import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InventoryStatusSwitch } from "@/components/inventory/InventoryCrudLayout";

type QuickAddUnitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (created: { id: number; name: string }) => void;
};

export function QuickAddUnitModal({
  open,
  onOpenChange,
  onCreated,
}: QuickAddUnitModalProps) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setShortName("");
    setIsActive(true);
  }, [open]);

  const handleSave = async () => {
    if (!name.trim() || !shortName.trim()) return;
    setSaving(true);
    try {
      const created = await apiFetch<{ id: number; name: string }>("/units", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          shortName: shortName.trim(),
          isActive,
        }),
      });
      toast.success("Unit created");
      onOpenChange(false);
      onCreated?.({ id: created.id, name: created.name });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create unit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add unit"
      description="Create a unit without leaving the product form."
      icon={<Ruler className="h-5 w-5" aria-hidden />}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Unit name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Piece"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Short name <span className="text-red-500">*</span>
          </label>
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. pc"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Status</label>
          <InventoryStatusSwitch checked={isActive} onCheckedChange={setIsActive} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim() || !shortName.trim()}
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

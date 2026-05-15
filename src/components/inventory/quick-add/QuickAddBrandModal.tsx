"use client";

import { useEffect, useState } from "react";
import { Tags } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { extractBranches } from "@/lib/apiList";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InventoryStatusSwitch,
  inventoryCheckboxClass,
} from "@/components/inventory/InventoryCrudLayout";

type Branch = { id: number; name: string };

type QuickAddBrandModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBranchId?: number;
  onCreated?: (created: { id: number; name: string }) => void;
};

export function QuickAddBrandModal({
  open,
  onOpenChange,
  defaultBranchId = 0,
  onCreated,
}: QuickAddBrandModalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [branchIds, setBranchIds] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setIsActive(true);
    setBranchIds(defaultBranchId > 0 ? [defaultBranchId] : []);
    void (async () => {
      try {
        const data = await apiFetch<unknown>("/branches");
        setBranches(extractBranches(data));
      } catch {
        setBranches([]);
      }
    })();
  }, [open, defaultBranchId]);

  const toggleBranch = (id: number) => {
    setBranchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await apiFetch<{ id: number; name: string }>("/brands", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          isActive,
          branchIds,
          image: "",
        }),
      });
      toast.success("Brand created");
      onOpenChange(false);
      onCreated?.({ id: created.id, name: created.name });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create Brand");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Brand"
      description="Create a Brand without leaving the product form."
      icon={<Tags className="h-5 w-5" aria-hidden />}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Brand name"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Description</label>
          <textarea
            className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>
        {branches.length > 0 ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium">Branches</label>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className={inventoryCheckboxClass}
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}
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
            disabled={saving || !name.trim()}
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

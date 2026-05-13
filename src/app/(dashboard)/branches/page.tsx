"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, LayoutGrid, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { extractApiList } from "@/lib/apiList";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
  InventoryStatusSwitch,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_BRANCHES = 1;

interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", isActive: true });

  const atBranchLimit = branches.length >= MAX_BRANCHES;

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await apiFetch<unknown>("/branches");
      const list = extractApiList<Branch>(raw, ["branches"]);
      setBranches(Array.isArray(list) ? list : []);
    } catch {
      setBranches([]);
      toast.error("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  const openCreate = () => {
    if (atBranchLimit) {
      toast.message("Branch limit reached", {
        description: `You can have at most ${MAX_BRANCHES} branch. Use Edit to update it.`,
      });
      return;
    }
    setEditing(null);
    setForm({ name: "", address: "", phone: "", isActive: true });
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setForm({
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      isActive: branch.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && atBranchLimit) {
      toast.error(`Maximum ${MAX_BRANCHES} branch allowed.`);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        isActive: form.isActive,
      };
      if (editing) {
        await apiFetch(`/branches/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success("Branch updated");
      } else {
        await apiFetch("/branches", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Branch created");
      }
      setModalOpen(false);
      await fetchBranches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (branches.length <= 1) {
      toast.error("The only branch cannot be deleted.");
      return;
    }
    if (!confirm("Delete this branch? Linked data may block deletion.")) return;
    try {
      await apiFetch(`/branches/${id}`, { method: "DELETE" });
      toast.success("Branch removed");
      await fetchBranches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const lastBranchLocked = branches.length <= 1;

  const columns = useMemo(
    () => [
      { key: "#", label: "#", className: "w-10", render: (_: Branch, i: number) => i + 1 },
      { key: "name", label: "Name", render: (b: Branch) => <span className="font-medium">{b.name}</span> },
      {
        key: "address",
        label: "Address",
        render: (b: Branch) => <span className="text-muted-foreground">{b.address || "—"}</span>,
      },
      {
        key: "phone",
        label: "Phone",
        render: (b: Branch) => <span className="text-muted-foreground">{b.phone || "—"}</span>,
      },
      {
        key: "status",
        label: "Status",
        render: (b: Branch) => <StatusBadge status={b.isActive ? "active" : "inactive"} />,
      },
      {
        key: "actions",
        label: "Actions",
        className: "w-[100px]",
        render: (b: Branch) => (
          <TableRowActions>
            <TableRowActionButton
              type="button"
              title="Edit"
              aria-label="Edit branch"
              onClick={() => openEdit(b)}
            >
              <Pencil className={tableActionIconClassName} />
            </TableRowActionButton>
            <TableRowActionButton
              type="button"
              title={
                lastBranchLocked
                  ? "Cannot delete the only branch"
                  : "Delete branch"
              }
              aria-label="Delete branch"
              variant="danger"
              disabled={lastBranchLocked}
              className={lastBranchLocked ? "pointer-events-none opacity-40" : undefined}
              onClick={() => void handleDelete(b.id)}
            >
              <Trash2 className={tableActionIconClassName} />
            </TableRowActionButton>
          </TableRowActions>
        ),
      },
    ],
    [branches.length, lastBranchLocked]
  );

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Building2}
        title="Branch management"
        description={`At most ${MAX_BRANCHES} branch. Edit it in place — the last branch cannot be deleted.`}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 rounded-xl sm:h-9"
          onClick={() => void fetchBranches()}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-10 rounded-xl sm:h-9"
          disabled={atBranchLimit}
          title={
            atBranchLimit
              ? `Maximum ${MAX_BRANCHES} branch already exists`
              : "Add branch"
          }
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add branch
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader
          icon={LayoutGrid}
          title="Overview"
          description={atBranchLimit ? "Limit reached — use Edit to change this branch." : "Create your store branch."}
        />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total branches" value={branches.length} icon={Building2} />
          <StatCard title="Active" value={branches.filter((b) => b.isActive).length} icon={Building2} />
          <StatCard title="Inactive" value={branches.filter((b) => !b.isActive).length} icon={Building2} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6">
          <InventorySectionHeader
            compact
            icon={Building2}
            title="Branches"
            description="Name, contact, and status."
          />
        </div>
        <div className="p-4 sm:p-5">
          <DataTable columns={columns} data={branches} loading={loading} inventoryStyle />
        </div>
      </section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit branch" : "Add branch"}
        description={
          editing
            ? "Update name, address, phone, or active status."
            : atBranchLimit
              ? "You cannot add another branch while one exists."
              : `Only ${MAX_BRANCHES} branch is allowed for this system.`
        }
        size="md"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" form="branch-form" disabled={saving || (!editing && atBranchLimit)}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        }
      >
        <form id="branch-form" onSubmit={handleSubmit} className="space-y-4 py-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="rounded-xl"
              placeholder="Branch name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Address</label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="rounded-xl"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Phone</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="rounded-xl"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Status</label>
            <InventoryStatusSwitch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

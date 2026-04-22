"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tags, Pencil, Trash2, Plus, RotateCcw, LayoutGrid, Layers } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";

const PAGE_SIZE = 20;

interface ExpenseCategory {
  id: number;
  name: string;
  isActive?: boolean;
  status?: string;
}

export default function ExpenseCategoriesPage() {
  const router = useRouter();
  const branchId = getSelectedBranch();
  const [rows, setRows] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ExpenseCategory | null>(null);
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>("/finance/expense-categories");
      const list = Array.isArray(res) ? (res as ExpenseCategory[]) : [];
      setRows(
        list.map((r) => ({
          ...r,
          status: (r.isActive ?? r.status === "active") ? "active" : "inactive",
        })),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [branchId]);

  useEffect(() => setPage(1), [search, status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const okSearch = !q || r.name.toLowerCase().includes(q);
      const rowStatus = r.status || "inactive";
      const okStatus = status === "all" || rowStatus === status;
      return okSearch && okStatus;
    });
  }, [rows, search, status]);

  const meta = {
    total: filtered.length,
    page,
    lastPage: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
  };
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAdd = () => {
    setEditItem(null);
    setFormName("");
    setFormStatus(true);
    setModalOpen(true);
  };

  const openEdit = (item: ExpenseCategory) => {
    setEditItem(item);
    setFormName(item.name);
    setFormStatus((item.status || "inactive") === "active");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { name: formName.trim(), isActive: formStatus };
      if (editItem) {
        await apiFetch(`/finance/expense-categories/${editItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/finance/expense-categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      await fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiFetch(`/finance/expense-categories/${id}`, { method: "DELETE" });
      await fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: ExpenseCategory, i: number) => (page - 1) * PAGE_SIZE + i + 1 },
    { key: "name", label: "Name", render: (r: ExpenseCategory) => <span className="font-medium">{r.name}</span> },
    { key: "status", label: "Status", render: (r: ExpenseCategory) => <StatusBadge status={r.status || "inactive"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r: ExpenseCategory) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(r)}>
            <Pencil className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton variant="danger" title="Delete" onClick={() => handleDelete(r.id)}>
            <Trash2 className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader icon={Tags} title="Expense Categories" description="Manage expense categories in one place.">
        <Button type="button" variant="outline" size="sm" className="h-10 w-full rounded-xl sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={() => void fetchData()}>
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
        <Button type="button" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Quick category snapshot." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total Categories" value={String(rows.length)} icon={Tags} />
          <StatCard title="Active" value={String(rows.filter((x) => x.status === "active").length)} icon={Layers} />
          <StatCard title="Inactive" value={String(rows.filter((x) => x.status === "inactive").length)} icon={Layers} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Layers} title="Category list" description="Inventory style table." />
        </div>
        <div className="space-y-4 p-5 sm:p-6 md:p-7">
          <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search categories...">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FilterBar>
          <DataTable columns={columns} data={paged} loading={loading} inventoryStyle />
          <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
        </div>
      </section>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editItem ? "Edit Category" : "Add Category"}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Category name" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Status</label>
            <button
              type="button"
              onClick={() => setFormStatus(!formStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formStatus ? "bg-primary" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formStatus ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-muted-foreground">{formStatus ? "Active" : "Inactive"}</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Tags, Pencil, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { getSelectedBranch } from "@/lib/auth";

interface IncomeCategory {
  id: number;
  name: string;
  status: string;
}

export default function IncomeCategoriesPage() {
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<IncomeCategory | null>(null);

  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const branchId = getSelectedBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      const data = await apiFetch<IncomeCategory[]>(`/finance/income-categories?${params}`);
      setCategories(data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branchId]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditItem(null);
    setFormName("");
    setFormStatus(true);
    setModalOpen(true);
  };

  const openEdit = (item: IncomeCategory) => {
    setEditItem(item);
    setFormName(item.name);
    setFormStatus(item.status === "active");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: formName,
        status: formStatus ? "active" : "inactive",
        branchId,
      };
      if (editItem) {
        await apiFetch(`/finance/income-categories/${editItem.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/finance/income-categories", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiFetch(`/finance/income-categories/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: IncomeCategory, i: number) => i + 1 },
    { key: "name", label: "Name", render: (c: IncomeCategory) => <span className="font-medium">{c.name}</span> },
    { key: "status", label: "Status", render: (c: IncomeCategory) => <StatusBadge status={c.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (c: IncomeCategory) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
            <Trash2 size={15} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Income Categories"
        description="Manage income categories"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1.5" /> Add Category
          </Button>
        }
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search categories..." />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editItem ? "Edit Category" : "Add Category"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Category name" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Status</label>
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
            <Button onClick={handleSave} disabled={saving || !formName}>
              {saving ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

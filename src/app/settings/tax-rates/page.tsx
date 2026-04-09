"use client";

import { useEffect, useState } from "react";
import { Percent, Pencil, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { getSelectedBranch } from "@/lib/auth";

interface TaxRate {
  id: number;
  name: string;
  rate: number;
  status: string;
}

export default function TaxRatesPage() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<TaxRate | null>(null);

  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const branchId = getSelectedBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      const res = await apiFetch<any>(`/settings/tax-rates?${params}`);
      const list = res.taxRates || res.data || (Array.isArray(res) ? res : []);
      setTaxRates(list);
    } catch {
      setTaxRates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branchId]);

  const filtered = taxRates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditItem(null);
    setFormName("");
    setFormRate("");
    setFormStatus(true);
    setModalOpen(true);
  };

  const openEdit = (item: TaxRate) => {
    setEditItem(item);
    setFormName(item.name);
    setFormRate(String(item.rate));
    setFormStatus(item.status === "active");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: formName,
        rate: Number(formRate),
        status: formStatus ? "active" : "inactive",
        branchId,
      };
      if (editItem) {
        await apiFetch(`/settings/tax-rates/${editItem.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/settings/tax-rates", { method: "POST", body: JSON.stringify(body) });
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
    if (!confirm("Are you sure you want to delete this tax rate?")) return;
    try {
      await apiFetch(`/settings/tax-rates/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: TaxRate, i: number) => i + 1 },
    { key: "name", label: "Name", render: (t: TaxRate) => <span className="font-medium">{t.name}</span> },
    { key: "rate", label: "Rate (%)", render: (t: TaxRate) => <span className="font-mono">{t.rate}%</span> },
    { key: "status", label: "Status", render: (t: TaxRate) => <StatusBadge status={t.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (t: TaxRate) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
            <Trash2 size={15} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tax Rates"
        description="Manage tax rates for products and services"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1.5" /> Add Tax Rate
          </Button>
        }
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search tax rates..." />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editItem ? "Edit Tax Rate" : "Add Tax Rate"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. VAT, GST" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Rate (%)</label>
            <Input type="number" step="0.01" min="0" max="100" value={formRate} onChange={(e) => setFormRate(e.target.value)} placeholder="e.g. 15" />
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
            <Button onClick={handleSave} disabled={saving || !formName || !formRate}>
              {saving ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

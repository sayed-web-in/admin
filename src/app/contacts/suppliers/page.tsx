"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Truck,
  TruckIcon,
  DollarSign,
  Plus,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Supplier {
  id: number;
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  totalDue: number;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "", address: "", status: "active",
  });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("search", search);
      const res = await apiFetch<any>(`/suppliers?${params}`);
      setSuppliers(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const stats = useMemo(() => {
    const active = suppliers.filter((s) => s.status?.toLowerCase() === "active").length;
    const totalDue = suppliers.reduce((sum, s) => sum + Number(s.totalDue || 0), 0);
    return { total: suppliers.length, active, totalDue };
  }, [suppliers]);

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", company: "", address: "", status: "active" });
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/suppliers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setAddModal(false);
      resetForm();
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setForm({
      name: supplier.name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      company: supplier.company || "",
      address: supplier.address || "",
      status: supplier.status || "active",
    });
    setEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedSupplier) return;
    setSaving(true);
    try {
      await apiFetch(`/suppliers/${selectedSupplier.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setEditModal(false);
      resetForm();
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Delete supplier "${supplier.name}"?`)) return;
    try {
      await apiFetch(`/suppliers/${supplier.id}`, { method: "DELETE" });
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: Supplier, i: number) => i + 1 },
    {
      key: "name",
      label: "Name",
      render: (item: Supplier) => (
        <span className="font-medium text-foreground">{item.name}</span>
      ),
    },
    { key: "company", label: "Company", render: (item: Supplier) => item.company || "—" },
    { key: "phone", label: "Phone", render: (item: Supplier) => item.phone || "—" },
    { key: "email", label: "Email", render: (item: Supplier) => item.email || "—" },
    {
      key: "totalDue",
      label: "Due",
      render: (item: Supplier) => {
        const due = Number(item.totalDue || 0);
        return due > 0 ? (
          <span className="text-red-600 font-medium">{formatPrice(due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (item: Supplier) => <StatusBadge status={item.status || "active"} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Supplier) => (
        <div className="flex items-center gap-1">
          <Link href={`/contacts/suppliers/${item.id}`}>
            <Button variant="ghost" size="sm"><Eye size={14} /></Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
            <Edit2 size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-600">
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const toggleClasses = "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer";

  const SupplierFormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Name *</label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Supplier name"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Company</label>
        <Input
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          placeholder="Company name"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Phone</label>
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="01XXXXXXXXX"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Email</label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Address</label>
        <Input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Full address"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Status</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, status: form.status === "active" ? "inactive" : "active" })}
            className={`${toggleClasses} ${form.status === "active" ? "bg-primary" : "bg-gray-300"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.status === "active" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm capitalize">{form.status}</span>
        </div>
      </div>
      <Button
        className="w-full mt-2"
        onClick={isEdit ? handleEdit : handleAdd}
        disabled={saving}
      >
        {saving ? "Saving..." : isEdit ? "Update Supplier" : "Add Supplier"}
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Suppliers"
        description="Manage your suppliers"
        action={
          <Button onClick={() => { resetForm(); setAddModal(true); }}>
            <Plus size={16} className="mr-2" /> Add Supplier
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Suppliers" value={stats.total} icon={Truck} />
        <StatCard title="Active Suppliers" value={stats.active} icon={TruckIcon} />
        <StatCard title="Total Due" value={formatPrice(stats.totalDue)} icon={DollarSign} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, company or phone..."
      />

      <DataTable columns={columns} data={suppliers} loading={loading} />

      <Modal open={addModal} onOpenChange={setAddModal} title="Add Supplier">
        <SupplierFormFields />
      </Modal>

      <Modal open={editModal} onOpenChange={setEditModal} title="Edit Supplier">
        <SupplierFormFields isEdit />
      </Modal>
    </div>
  );
}

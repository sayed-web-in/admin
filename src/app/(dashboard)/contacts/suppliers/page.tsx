"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  TruckIcon,
  DollarSign,
  Plus,
  Eye,
  Edit2,
  Trash2,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { unwrapPaginated } from "@/lib/apiList";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import {
  TableRowActions,
  TableRowActionButton,
  TableRowActionLink,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;

interface Supplier {
  id: number;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  totalDue: number;
  advanceBalance?: number | string | null;
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({ total: 0, active: 0, totalDue: 0 });

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    isActive: true,
    advanceBalance: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) qs.set("search", debouncedSearch);
      const res = await apiFetch<unknown>(`/suppliers?${qs.toString()}`);
      const p = unwrapPaginated<Supplier>(res);
      if (p) {
        setSuppliers(p.data);
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        if (p.page > p.lastPage) setPage(p.lastPage);
      } else {
        setSuppliers([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setSuppliers([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const loadSummary = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("search", debouncedSearch);
      const res = await apiFetch<unknown>(`/suppliers/summary?${qs.toString()}`);
      const body =
        res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      setStats({
        total: Number(body.total) || 0,
        active: Number(body.active) || 0,
        totalDue: Number(body.totalDue) || 0,
      });
    } catch {
      setStats({ total: 0, active: 0, totalDue: 0 });
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const refresh = () => {
    void Promise.all([fetchSuppliers(), loadSummary()]);
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      address: "",
      isActive: true,
      advanceBalance: "",
    });
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const openAdv = form.advanceBalance.trim();
      const openAdvNum =
        openAdv === "" ? undefined : Math.max(0, Number(openAdv));
      await apiFetch("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          address: form.address.trim() || undefined,
          isActive: form.isActive,
          ...(openAdvNum !== undefined &&
          Number.isFinite(openAdvNum) &&
          openAdvNum > 0
            ? { advanceBalance: openAdvNum }
            : {}),
        }),
      });
      setAddModal(false);
      resetForm();
      await Promise.all([fetchSuppliers(), loadSummary()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Create failed");
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
      isActive: supplier.isActive,
      advanceBalance:
        supplier.advanceBalance != null
          ? String(Number(supplier.advanceBalance))
          : "",
    });
    setEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedSupplier) return;
    setSaving(true);
    try {
      const advRaw = form.advanceBalance.trim();
      const advNum =
        advRaw === "" ? undefined : Math.max(0, Number(advRaw));
      await apiFetch(`/suppliers/${selectedSupplier.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          address: form.address.trim() || undefined,
          isActive: form.isActive,
          ...(advNum !== undefined && Number.isFinite(advNum)
            ? { advanceBalance: advNum }
            : {}),
        }),
      });
      setEditModal(false);
      resetForm();
      setSelectedSupplier(null);
      await Promise.all([fetchSuppliers(), loadSummary()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Delete supplier "${supplier.name}"?`)) return;
    try {
      await apiFetch(`/suppliers/${supplier.id}`, { method: "DELETE" });
      await Promise.all([fetchSuppliers(), loadSummary()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Supplier, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    {
      key: "name",
      label: "Name",
      render: (item: Supplier) => <span className="font-medium">{item.name}</span>,
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
          <span className="font-medium text-red-600">{formatPrice(due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (item: Supplier) => (
        <StatusBadge status={item.isActive ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Supplier) => (
        <TableRowActions>
          <TableRowActionLink href={`/contacts/suppliers/${item.id}`} title="View">
            <Eye className={tableActionIconClassName} />
          </TableRowActionLink>
          <TableRowActionButton title="Edit" onClick={() => openEdit(item)}>
            <Edit2 className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton variant="danger" title="Delete" onClick={() => handleDelete(item)}>
            <Trash2 className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  const SupplierFormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Name *</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Company</label>
        <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Phone</label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Email</label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Address</label>
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Opening advance balance {!isEdit && "(optional)"}
        </label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={form.advanceBalance}
          onChange={(e) =>
            setForm({ ...form, advanceBalance: e.target.value })
          }
          placeholder={isEdit ? "Leave blank to keep current" : "0.00"}
        />
        {isEdit ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Set amount to update; leave blank to leave advance unchanged.
          </p>
        ) : null}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Status</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, isActive: !form.isActive })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.isActive ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm">{form.isActive ? "Active" : "Inactive"}</span>
        </div>
      </div>
      <Button className="mt-2 w-full" onClick={isEdit ? handleEdit : handleAdd} disabled={saving}>
        {saving ? "Saving..." : isEdit ? "Update Supplier" : "Add Supplier"}
      </Button>
    </div>
  );

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Truck}
        title="Suppliers"
        description="Manage suppliers, status, and due balances with server-side pagination."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={refresh}
        >
          <RotateCcw className="h-4 w-4 shrink-0" /> Refresh
        </Button>
        <Button
          type="button"
          className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto"
          onClick={() => {
            resetForm();
            setAddModal(true);
          }}
        >
          <Plus className="h-4 w-4 shrink-0" /> Add Supplier
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Summary uses GET /suppliers/summary with current search query."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Suppliers" value={stats.total} icon={Truck} />
            <StatCard title="Active Suppliers" value={stats.active} icon={TruckIcon} />
            <StatCard title="Total Due" value={formatPrice(stats.totalDue)} icon={DollarSign} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Layers}
              title="Supplier list"
              description={`Paginated (${PAGE_SIZE} per page). Search by name, company, or phone.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name, company or phone..."
            />

            <DataTable columns={columns} data={suppliers} loading={loading} inventoryStyle />
            <InventoryTablePagination
              page={meta.page}
              lastPage={meta.lastPage}
              total={meta.total}
              loading={loading}
              onPageChange={setPage}
            />
          </div>
        </section>
      </div>

      <Modal open={addModal} onOpenChange={setAddModal} title="Add Supplier">
        <SupplierFormFields />
      </Modal>

      <Modal open={editModal} onOpenChange={setEditModal} title="Edit Supplier">
        <SupplierFormFields isEdit />
      </Modal>
    </div>
  );
}
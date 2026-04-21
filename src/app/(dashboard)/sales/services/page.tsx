"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  CheckCircle,
  XCircle,
  Plus,
  Pencil,
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
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;

interface Service {
  id: number;
  name: string;
  price: number;
  description?: string;
  status: string;
}

function normalizeService(row: {
  id: number;
  name: string;
  price: unknown;
  description?: string | null;
  isActive: boolean;
}): Service {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description ?? undefined,
    status: row.isActive ? "active" : "inactive",
  };
}

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadStats = useCallback(async () => {
    const common = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
    try {
      const [allRes, activeRes, inactiveRes] = await Promise.all([
        apiFetch<unknown>(`/services?page=1&limit=1${common}`),
        apiFetch<unknown>(`/services?page=1&limit=1&isActive=true${common}`),
        apiFetch<unknown>(`/services?page=1&limit=1&isActive=false${common}`),
      ]);
      const all = unwrapPaginated(allRes);
      const act = unwrapPaginated(activeRes);
      const inact = unwrapPaginated(inactiveRes);
      setStats({
        total: all?.total ?? 0,
        active: act?.total ?? 0,
        inactive: inact?.total ?? 0,
      });
    } catch {
      setStats({ total: 0, active: 0, inactive: 0 });
    }
  }, [debouncedSearch]);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) qs.set("search", debouncedSearch);
      const res = await apiFetch<unknown>(`/services?${qs}`);
      const p = unwrapPaginated<Parameters<typeof normalizeService>[0]>(res);
      if (p) {
        setServices(p.data.map(normalizeService));
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        if (p.page > p.lastPage) setPage(p.lastPage);
      } else {
        setServices([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setServices([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const refresh = () => {
    void Promise.all([fetchServices(), loadStats()]);
  };

  const openAdd = () => {
    setEditing(null);
    setName("");
    setPrice("");
    setDescription("");
    setStatus(true);
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setName(service.name);
    setPrice(String(service.price));
    setDescription(service.description || "");
    setStatus(service.status === "active");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !price) return;
    setSaving(true);
    try {
      const payload = {
        name,
        price: Number(price),
        description,
        isActive: status,
      };
      if (editing) {
        await apiFetch(`/services/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await Promise.all([fetchServices(), loadStats()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      await apiFetch(`/services/${id}`, { method: "DELETE" });
      await Promise.all([fetchServices(), loadStats()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Service, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    { key: "name", label: "Name" },
    {
      key: "price",
      label: "Price",
      render: (item: Service) => formatPrice(Number(item.price)),
    },
    {
      key: "description",
      label: "Description",
      render: (item: Service) => (
        <span className="line-clamp-1 text-muted-foreground">
          {item.description || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Service) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Service) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
            <Trash2 size={14} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Wrench}
        title="Services"
        description="Sell add-on services at POS — same chrome as inventory settings lists."
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
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          Refresh
        </Button>
        <Button
          type="button"
          className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto"
          onClick={openAdd}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add service
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Totals follow the search box (active / inactive counts use the same query)."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Services" value={stats.total} icon={Wrench} />
            <StatCard title="Active" value={stats.active} icon={CheckCircle} />
            <StatCard title="Inactive" value={stats.inactive} icon={XCircle} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Layers}
              title="Service list"
              description={`Paginated (${PAGE_SIZE} per page). Search is sent to the API.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search services…"
            />
            <DataTable columns={columns} data={services} loading={loading} inventoryStyle />
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

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Service" : "Add Service"}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Service name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Price <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Service description"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Status</label>
            <button
              type="button"
              onClick={() => setStatus(!status)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                status ? "bg-orange-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="ml-2 text-sm">{status ? "Active" : "Inactive"}</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !price}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

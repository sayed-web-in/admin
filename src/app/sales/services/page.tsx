"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Wrench,
  CheckCircle,
  XCircle,
  Plus,
  Pencil,
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

interface Service {
  id: number;
  name: string;
  price: number;
  description?: string;
  status: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>("/services?limit=100");
      setServices(res.data || (Array.isArray(res) ? res : res.services || []));
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filtered = useMemo(
    () => services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [services, search]
  );

  const stats = useMemo(() => {
    const active = services.filter((s) => s.status === "active").length;
    const inactive = services.length - active;
    return { total: services.length, active, inactive };
  }, [services]);

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
        status: status ? "active" : "inactive",
      };
      if (editing) {
        await apiFetch(`/services/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      fetchServices();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      await apiFetch(`/services/${id}`, { method: "DELETE" });
      fetchServices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: Service, i: number) => i + 1 },
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
        <span className="text-muted-foreground line-clamp-1">{item.description || "—"}</span>
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
        <div className="flex items-center gap-1">
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
    <div className="p-4 md:p-6">
      <PageHeader
        title="Services"
        description="Manage service offerings"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-2" /> Add Service
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Services" value={stats.total} icon={Wrench} />
        <StatCard title="Active" value={stats.active} icon={CheckCircle} />
        <StatCard title="Inactive" value={stats.inactive} icon={XCircle} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search services..."
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Service" : "Add Service"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Service name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
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
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Service description"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
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

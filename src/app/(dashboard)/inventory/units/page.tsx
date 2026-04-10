"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Ruler,
  CheckCircle,
  XCircle,
  Star,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Unit {
  id: number;
  name: string;
  shortName: string;
  status: string;
}

function normalizeUnit(raw: {
  id: number;
  name: string;
  shortName?: string | null;
  isActive?: boolean;
}): Unit {
  return {
    id: raw.id,
    name: raw.name,
    shortName: raw.shortName ?? "",
    status: raw.isActive ? "active" : "inactive",
  };
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  const [formName, setFormName] = useState("");
  const [formShort, setFormShort] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<
        | { data: Parameters<typeof normalizeUnit>[0][]; total?: number }
        | { units: Unit[] }
      >("/units?limit=500");
      const list = Array.isArray(res)
        ? res
        : "data" in res && Array.isArray(res.data)
          ? res.data
          : "units" in res
            ? res.units
            : [];
      setUnits(list.map((u) => normalizeUnit(u)));
    } catch {
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const filtered = useMemo(
    () =>
      units.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          (u.shortName ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [units, search]
  );

  const stats = useMemo(() => {
    const active = units.filter((u) => u.status === "active").length;
    const inactive = units.length - active;
    const latest = units.length > 0 ? units[units.length - 1].name : "N/A";
    return { total: units.length, active, inactive, latest };
  }, [units]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormShort("");
    setFormStatus(true);
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setFormName(unit.name);
    setFormShort(unit.shortName);
    setFormStatus(unit.status === "active");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formShort.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName,
        shortName: formShort,
        isActive: formStatus,
      };
      if (editing) {
        await apiFetch(`/units/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/units", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      fetchUnits();
      toast.success(editing ? "Unit updated" : "Unit created");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this unit?")) return;
    try {
      await apiFetch(`/units/${id}`, { method: "DELETE" });
      fetchUnits();
      toast.success("Unit deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Unit, i: number) => i + 1,
    },
    { key: "name", label: "Name" },
    { key: "shortName", label: "Short Name" },
    {
      key: "status",
      label: "Status",
      render: (item: Unit) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Unit) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 size={14} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Unit Management"
        description="Manage measurement units"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-2" /> Add Unit
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Units" value={stats.total} icon={Ruler} />
        <StatCard title="Active" value={stats.active} icon={CheckCircle} />
        <StatCard title="Inactive" value={stats.inactive} icon={XCircle} />
        <StatCard title="Latest Unit" value={stats.latest} icon={Star} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search units..."
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Unit" : "Add Unit"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Unit Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Kilogram"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Short Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formShort}
              onChange={(e) => setFormShort(e.target.value)}
              placeholder="e.g. kg"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <button
              type="button"
              onClick={() => setFormStatus(!formStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formStatus ? "bg-orange-500" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formStatus ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
            <span className="ml-2 text-sm">
              {formStatus ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formShort.trim()}
            >
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

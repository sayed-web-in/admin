"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Ruler,
  CheckCircle,
  XCircle,
  Star,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { unwrapPaginated, extractApiList } from "@/lib/apiList";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
  InventoryStatusSwitch,
} from "@/components/inventory/InventoryCrudLayout";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
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

const PAGE_SIZE = 20;

export default function UnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  const [formName, setFormName] = useState("");
  const [formShort, setFormShort] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (searchQuery) params.set("search", searchQuery);
      const res = await apiFetch<unknown>(`/units?${params.toString()}`);
      const paginated = unwrapPaginated<Parameters<typeof normalizeUnit>[0]>(res);
      if (paginated) {
        setUnits(paginated.data.map((u) => normalizeUnit(u)));
        setMeta({ total: paginated.total, lastPage: paginated.lastPage });
      } else {
        const list = extractApiList<Parameters<typeof normalizeUnit>[0]>(res, [
          "units",
        ]);
        setUnits(list.map((u) => normalizeUnit(u)));
        setMeta({ total: list.length, lastPage: 1 });
      }
    } catch {
      setUnits([]);
      setMeta({ total: 0, lastPage: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void fetchUnits();
  }, [fetchUnits]);

  const stats = useMemo(() => {
    const active = units.filter((u) => u.status === "active").length;
    const inactive = units.length - active;
    const latest = units.length > 0 ? units[units.length - 1].name : "—";
    return { total: meta.total, active, inactive, latest };
  }, [units, meta.total]);

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
      void fetchUnits();
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
      if (units.length <= 1 && page > 1) setPage((p) => Math.max(1, p - 1));
      else void fetchUnits();
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
    {
      key: "name",
      label: "Name",
      render: (item: Unit) => (
        <span className="font-semibold text-foreground">{item.name}</span>
      ),
    },
    { key: "shortName", label: "Short" },
    {
      key: "status",
      label: "Status",
      render: (item: Unit) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Unit) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(item)}>
            <Pencil className={tableActionIconClassName} aria-hidden />
          </TableRowActionButton>
          <TableRowActionButton
            variant="danger"
            title="Delete"
            onClick={() => void handleDelete(item.id)}
          >
            <Trash2 className={tableActionIconClassName} aria-hidden />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Ruler}
        title="Units"
        description="Measurement units — paginated, API search."
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
          onClick={() => void fetchUnits()}
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
          Add unit
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Total is server-wide. Active / inactive / latest are for the current page."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total units" value={stats.total} icon={Ruler} />
            <StatCard title="Active (page)" value={stats.active} icon={CheckCircle} />
            <StatCard title="Inactive (page)" value={stats.inactive} icon={XCircle} />
            <StatCard title="Latest (page)" value={stats.latest} icon={Star} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Ruler}
              title="Unit list"
              description={`${PAGE_SIZE} per page · search uses the API.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              searchPlaceholder="Search units…"
            />
            <DataTable columns={columns} data={units} loading={loading} inventoryStyle />
            <InventoryTablePagination
              page={page}
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
            <label className="mb-2 block text-sm font-medium">Status</label>
            <InventoryStatusSwitch checked={formStatus} onCheckedChange={setFormStatus} />
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

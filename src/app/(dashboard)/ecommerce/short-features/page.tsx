"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import {
  Headset,
  ShieldCheck,
  Truck,
  Store,
  BadgeCheck,
  CheckCircle,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { unwrapPaginated } from "@/lib/apiList";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatCard } from "@/components/common/StatCard";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import DescriptionEditor from "../../inventory/add-product/DescriptionEditor";

interface ShortFeature {
  id: number;
  title: string;
  description: string;
  icon: string;
  displayOrder?: number;
  isActive: boolean;
}

const ICON_OPTIONS = [
  { value: "HEADSET", label: "24/7 Support", icon: Headset },
  { value: "SHIELD_CHECK", label: "Official Product", icon: ShieldCheck },
  { value: "TRUCK", label: "Fast Delivery", icon: Truck },
  { value: "STORE", label: "Store Pickup", icon: Store },
  { value: "BADGE_CHECK", label: "Certified Quality", icon: BadgeCheck },
  { value: "CHECK_CIRCLE", label: "Trusted Service", icon: CheckCircle },
] as const;

const iconMap = Object.fromEntries(ICON_OPTIONS.map((x) => [x.value, x.icon])) as Record<
  string,
  (props: { className?: string }) => JSX.Element
>;

const plain = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export default function ShortFeaturesPage() {
  const [items, setItems] = useState<ShortFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShortFeature | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<(typeof ICON_OPTIONS)[number]["value"]>("HEADSET");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>("/short-features?page=1&limit=200");
      const p = unwrapPaginated<ShortFeature>(res);
      setItems(p?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        plain(it.description).toLowerCase().includes(q)
    );
  }, [items, search]);

  const openCreate = () => {
    const nextOrder =
      items.length > 0 ? Math.max(...items.map((x) => x.displayOrder ?? 0)) + 1 : 1;
    setEditing(null);
    setTitle("");
    setDescription("");
    setIcon("HEADSET");
    setDisplayOrder(nextOrder);
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (item: ShortFeature) => {
    setEditing(item);
    setTitle(item.title);
    setDescription(item.description);
    setIcon((item.icon as (typeof ICON_OPTIONS)[number]["value"]) || "HEADSET");
    setDisplayOrder(item.displayOrder ?? 0);
    setIsActive(item.isActive);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!plain(description)) return toast.error("Description is required");
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        icon,
        displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
        isActive,
      };
      if (editing) {
        await apiFetch(`/short-features/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Short feature updated");
      } else {
        await apiFetch("/short-features", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Short feature created");
      }
      setModalOpen(false);
      void fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this short feature?")) return;
    try {
      await apiFetch(`/short-features/${id}`, { method: "DELETE" });
      toast.success("Short feature deleted");
      void fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: ShortFeature, i: number) => i + 1 },
    {
      key: "icon",
      label: "Icon",
      className: "w-20",
      render: (row: ShortFeature) => {
        const Icon = iconMap[row.icon] ?? Headset;
        return (
          <div className="size-10 rounded-full bg-gradient-to-r from-teal-400 to-gray-700 text-white flex items-center justify-center shadow-md">
            <Icon className="size-5" />
          </div>
        );
      },
    },
    {
      key: "title",
      label: "Title",
      render: (row: ShortFeature) => (
        <div>
          <p className="font-semibold text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">Order: {row.displayOrder ?? 0}</p>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (row: ShortFeature) => (
        <span className="text-sm text-muted-foreground line-clamp-2 max-w-[520px]">
          {plain(row.description)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: ShortFeature) => (
        <StatusBadge status={row.isActive ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: ShortFeature) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(row)}>
            <Pencil className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton
            variant="danger"
            title="Delete"
            onClick={() => handleDelete(row.id)}
          >
            <Trash2 className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  const activeCount = filtered.filter((x) => x.isActive).length;
  const SelectedIcon = iconMap[icon] ?? Headset;

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Sparkles}
        title="Short Features"
        description="Manage six short feature boxes shown before FAQ."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => void fetchItems()}
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          Refresh
        </Button>
        <Button
          type="button"
          className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4 shrink-0" />
          Add Feature
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader
          icon={Sparkles}
          title="Overview"
          description="Frontend displays max 6 active items ordered by display order."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total" value={filtered.length} icon={Sparkles} />
          <StatCard title="Active" value={activeCount} icon={CheckCircle} />
          <StatCard title="Inactive" value={filtered.length - activeCount} icon={XCircle} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader
            compact
            icon={Sparkles}
            title="Feature list"
            description={`${filtered.length} short feature${filtered.length !== 1 ? "s" : ""}`}
          />
        </div>
        <div className="p-5 sm:p-6">
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by title or description..."
          />
          <DataTable columns={columns} data={filtered} loading={loading} />
        </div>
      </section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Short Feature" : "Add Short Feature"}
        icon={<Sparkles className="w-5 h-5" />}
        size="xl"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 24/7 Customer Support"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Icon *</label>
            <div className="flex items-center gap-3">
              <select
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                value={icon}
                onChange={(e) =>
                  setIcon(e.target.value as (typeof ICON_OPTIONS)[number]["value"])
                }
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="size-10 rounded-full bg-gradient-to-r from-teal-400 to-gray-700 text-white flex items-center justify-center shadow-md">
                <SelectedIcon className="size-5" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description *</label>
            <DescriptionEditor
              value={description}
              onChange={setDescription}
              placeholder="Write short feature description..."
              minHeight="180px"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Display Order</label>
            <Input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              min={0}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active Status</p>
              <p className="text-xs text-muted-foreground">Show this feature on homepage</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

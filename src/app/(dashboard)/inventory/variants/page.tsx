"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Palette, Pencil, Trash2, Plus, X, RotateCcw, LayoutGrid } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface AttributeValue {
  id?: number;
  value: string;
}

interface Attribute {
  id: number;
  name: string;
  status: string;
  values: AttributeValue[];
}

function normalizeAttribute(raw: {
  id: number;
  name: string;
  isActive?: boolean;
  values?: { id: number; value: string }[];
}): Attribute {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.isActive ? "active" : "inactive",
    values: (raw.values ?? []).map((v) => ({ id: v.id, value: v.value })),
  };
}

const PAGE_SIZE = 20;

export default function VariantsPage() {
  const router = useRouter();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Attribute | null>(null);

  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [formValues, setFormValues] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const fetchAttributes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (searchQuery) params.set("search", searchQuery);
      const res = await apiFetch<unknown>(`/attributes?${params.toString()}`);
      const paginated = unwrapPaginated<Parameters<typeof normalizeAttribute>[0]>(res);
      if (paginated) {
        setAttributes(paginated.data.map((a) => normalizeAttribute(a)));
        setMeta({ total: paginated.total, lastPage: paginated.lastPage });
      } else {
        const list = extractApiList<Parameters<typeof normalizeAttribute>[0]>(res, [
          "attributes",
        ]);
        setAttributes(list.map((a) => normalizeAttribute(a)));
        setMeta({ total: list.length, lastPage: 1 });
      }
    } catch {
      setAttributes([]);
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
    void fetchAttributes();
  }, [fetchAttributes]);

  const stats = useMemo(() => {
    const active = attributes.filter((a) => a.status === "active").length;
    const valueCount = attributes.reduce((s, a) => s + a.values.length, 0);
    return { total: meta.total, active, valueCount };
  }, [attributes, meta.total]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormStatus(true);
    setFormValues([""]);
    setModalOpen(true);
  };

  const openEdit = (attr: Attribute) => {
    setEditing(attr);
    setFormName(attr.name);
    setFormStatus(attr.status === "active");
    setFormValues(
      attr.values.length > 0 ? attr.values.map((v) => v.value) : [""]
    );
    setModalOpen(true);
  };

  const addValueField = () => setFormValues((prev) => [...prev, ""]);

  const removeValueField = (idx: number) => {
    setFormValues((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateValue = (idx: number, val: string) => {
    setFormValues((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const trimmed = formValues.map((v) => v.trim()).filter(Boolean);
    if (trimmed.length === 0) return;
    setSaving(true);
    try {
      const valueObjects = trimmed.map((v) => ({ value: v }));
      const payload = {
        name: formName,
        isActive: formStatus,
        values: valueObjects,
      };
      if (editing) {
        await apiFetch(`/attributes/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/attributes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      void fetchAttributes();
      toast.success(editing ? "Attribute updated" : "Attribute created");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this attribute?")) return;
    try {
      await apiFetch(`/attributes/${id}`, { method: "DELETE" });
      if (attributes.length <= 1 && page > 1) setPage((p) => Math.max(1, p - 1));
      else void fetchAttributes();
      toast.success("Attribute deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Attribute, i: number) => i + 1,
    },
    {
      key: "name",
      label: "Attribute",
      render: (item: Attribute) => (
        <span className="font-semibold text-foreground">{item.name}</span>
      ),
    },
    {
      key: "values",
      label: "Values",
      render: (item: Attribute) => (
        <div className="flex max-w-[320px] flex-wrap gap-1">
          {item.values.map((v, i) => (
            <Badge key={i} variant="secondary" className="font-normal">
              {v.value}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Attribute) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Attribute) => (
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
        icon={Palette}
        title="Variants & attributes"
        description="Product attributes (e.g. Color, Size) and values — paginated API."
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
          onClick={() => void fetchAttributes()}
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
          Add attribute
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Total attributes is server-wide. Active and value count are for the current page."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total attributes" value={stats.total} icon={Palette} />
            <StatCard title="Active (page)" value={stats.active} icon={Palette} />
            <StatCard title="Values (page)" value={stats.valueCount} icon={Palette} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Palette}
              title="Attribute list"
              description={`${PAGE_SIZE} per page · search uses the API.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              searchPlaceholder="Search attributes…"
            />
            <DataTable
              columns={columns}
              data={attributes}
              loading={loading}
              inventoryStyle
            />
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
        title={editing ? "Edit Attribute" : "Add Attribute"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Attribute Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Color, Size"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Values <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {formValues.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={val}
                    onChange={(e) => updateValue(idx, e.target.value)}
                    placeholder={`Value ${idx + 1}`}
                  />
                  {formValues.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeValueField(idx)}
                    >
                      <X size={14} className="text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addValueField} className="mt-1">
                <Plus size={14} className="mr-1" /> Add value
              </Button>
            </div>
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
              disabled={
                saving ||
                !formName.trim() ||
                formValues.every((v) => !v.trim())
              }
            >
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

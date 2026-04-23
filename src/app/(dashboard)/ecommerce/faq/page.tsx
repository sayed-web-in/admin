"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleHelp,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle,
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

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  displayOrder?: number;
  isActive: boolean;
}

const plain = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export default function FaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>("/faqs?page=1&limit=200");
      const p = unwrapPaginated<FaqItem>(res);
      setItems(p?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFaqs();
  }, [fetchFaqs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.question.toLowerCase().includes(q) ||
        plain(it.answer).toLowerCase().includes(q)
    );
  }, [items, search]);

  const openCreate = () => {
    const nextOrder =
      items.length > 0 ? Math.max(...items.map((x) => x.displayOrder ?? 0)) + 1 : 1;
    setEditing(null);
    setQuestion("");
    setAnswer("");
    setDisplayOrder(nextOrder);
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditing(item);
    setQuestion(item.question);
    setAnswer(item.answer);
    setDisplayOrder(item.displayOrder ?? 0);
    setIsActive(item.isActive);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!question.trim()) return toast.error("Question is required");
    if (!plain(answer)) return toast.error("Answer is required");
    setSaving(true);
    try {
      const payload = {
        question: question.trim(),
        answer,
        displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
        isActive,
      };
      if (editing) {
        await apiFetch(`/faqs/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("FAQ updated");
      } else {
        await apiFetch("/faqs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("FAQ created");
      }
      setModalOpen(false);
      void fetchFaqs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this FAQ?")) return;
    try {
      await apiFetch(`/faqs/${id}`, { method: "DELETE" });
      toast.success("FAQ deleted");
      void fetchFaqs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: FaqItem, i: number) => i + 1 },
    {
      key: "question",
      label: "Question",
      render: (row: FaqItem) => (
        <div>
          <p className="font-semibold text-foreground">{row.question}</p>
          <p className="text-xs text-muted-foreground">Order: {row.displayOrder ?? 0}</p>
        </div>
      ),
    },
    {
      key: "answer",
      label: "Answer",
      render: (row: FaqItem) => (
        <span className="text-sm text-muted-foreground line-clamp-2 max-w-[520px]">
          {plain(row.answer)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: FaqItem) => <StatusBadge status={row.isActive ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: FaqItem) => (
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

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={CircleHelp}
        title="FAQ"
        description="Add frequently asked questions shown on storefront homepage."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => void fetchFaqs()}
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
          Add FAQ
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader
          icon={CircleHelp}
          title="Overview"
          description="FAQ items are sorted by display order on frontend."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total" value={filtered.length} icon={CircleHelp} />
          <StatCard title="Active" value={activeCount} icon={CheckCircle} />
          <StatCard title="Inactive" value={filtered.length - activeCount} icon={XCircle} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader
            compact
            icon={CircleHelp}
            title="FAQ list"
            description={`${filtered.length} FAQ item${filtered.length !== 1 ? "s" : ""}`}
          />
        </div>
        <div className="p-5 sm:p-6">
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by question or answer..."
          />
          <DataTable columns={columns} data={filtered} loading={loading} />
        </div>
      </section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit FAQ" : "Add FAQ"}
        icon={<CircleHelp className="w-5 h-5" />}
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
            <label className="block text-sm font-medium mb-1.5">Question *</label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Does Future Technology sell original products?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Answer *</label>
            <DescriptionEditor
              value={answer}
              onChange={setAnswer}
              placeholder="Write the answer with toolbox editor..."
              minHeight="220px"
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
              <p className="text-xs text-muted-foreground">Show this FAQ on storefront</p>
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

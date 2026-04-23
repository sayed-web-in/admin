"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
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

interface Article {
  id: number;
  title: string;
  slug: string;
  image?: string | null;
  content: string;
  isActive: boolean;
  createdAt: string;
}

const stripHtml = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export default function EcommerceArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>("/articles?page=1&limit=100");
      const paginated = unwrapPaginated<Article>(res);
      setArticles(paginated?.data ?? []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle("");
    setFormContent("");
    setFormIsActive(true);
    setFormImage(null);
    setFormImagePreview("");
    setFormImageUrl("");
    setModalOpen(true);
  };

  const openEdit = (article: Article) => {
    setEditing(article);
    setFormTitle(article.title);
    setFormContent(article.content || "");
    setFormIsActive(article.isActive);
    setFormImage(null);
    setFormImagePreview(article.image || "");
    setFormImageUrl(article.image || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!stripHtml(formContent)) {
      toast.error("Content is required");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = formImageUrl;
      if (formImage) {
        const fd = new FormData();
        fd.append("file", formImage);
        const uploaded = await apiUpload("/upload/single", fd);
        imageUrl = uploaded?.url ?? uploaded?.data?.url ?? "";
      }

      const payload = {
        title: formTitle.trim(),
        content: formContent,
        image: imageUrl || undefined,
        isActive: formIsActive,
      };

      if (editing) {
        await apiFetch(`/articles/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Article updated");
      } else {
        await apiFetch("/articles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Article created");
      }

      setModalOpen(false);
      void fetchArticles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this article?")) return;
    try {
      await apiFetch(`/articles/${id}`, { method: "DELETE" });
      toast.success("Article deleted");
      void fetchArticles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.slug.toLowerCase().includes(query) ||
        stripHtml(a.content).toLowerCase().includes(query)
    );
  }, [articles, search]);

  const activeCount = filtered.filter((a) => a.isActive).length;
  const inactiveCount = filtered.length - activeCount;

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Article, i: number) => i + 1,
    },
    {
      key: "image",
      label: "Image",
      className: "w-[4.75rem]",
      render: (row: Article) =>
        row.image ? (
          <div className="relative h-12 w-20 rounded-xl border border-border/70 overflow-hidden bg-muted">
            <Image
              src={resolveMediaUrl(row.image)}
              alt={row.title}
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex h-12 w-20 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        ),
    },
    {
      key: "title",
      label: "Article",
      render: (row: Article) => (
        <div>
          <p className="font-semibold text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">/{row.slug}</p>
        </div>
      ),
    },
    {
      key: "excerpt",
      label: "Excerpt",
      render: (row: Article) => (
        <span className="text-sm text-muted-foreground line-clamp-2 max-w-[420px]">
          {stripHtml(row.content).slice(0, 180) || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: Article) => (
        <StatusBadge status={row.isActive ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: Article) => (
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

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={FileText}
        title="Articles"
        description="Publish SEO content for ecommerce pages and homepage highlights."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => void fetchArticles()}
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
          Add Article
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={FileText}
            title="Overview"
            description="Content that will appear on storefront article sections."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total" value={filtered.length} icon={FileText} />
            <StatCard title="Active" value={activeCount} icon={CheckCircle} />
            <StatCard title="Inactive" value={inactiveCount} icon={XCircle} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={FileText}
              title="Article list"
              description={`${filtered.length} article${filtered.length !== 1 ? "s" : ""} found`}
            />
          </div>
          <div className="p-5 sm:p-6">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by title, slug, or content..."
            />
            <DataTable columns={columns} data={filtered} loading={loading} />
          </div>
        </section>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Article" : "Add Article"}
        icon={<FileText className="w-5 h-5" />}
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
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Article title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Cover Image</label>
            <div className="flex items-start gap-3">
              <div className="relative w-32 h-20 rounded-xl border border-border bg-muted overflow-hidden flex-shrink-0">
                {formImagePreview ? (
                  <Image
                    src={resolveMediaUrl(formImagePreview)}
                    alt="preview"
                    fill
                    className="object-cover"
                    sizes="128px"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={22} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFormImage(file);
                  setFormImagePreview(URL.createObjectURL(file));
                }}
                className="text-sm text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Content *</label>
            <DescriptionEditor
              value={formContent}
              onChange={setFormContent}
              placeholder="Write the article with heading, list, links and highlighted text..."
              minHeight="260px"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active Status</p>
              <p className="text-xs text-muted-foreground">
                Show this article on storefront sections
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formIsActive ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  formIsActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

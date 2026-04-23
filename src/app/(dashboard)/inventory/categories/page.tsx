"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FolderTree,
  Layers,
  CheckCircle,
  Star,
  Pencil,
  Trash2,
  Plus,
  ImageIcon,
  Eye,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api";
import { unwrapPaginated, extractBranches } from "@/lib/apiList";
import { resolveMediaUrl } from "@/app/(dashboard)/inventory/add-product/media";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
  InventoryStatusSwitch,
  inventoryCheckboxClass,
} from "@/components/inventory/InventoryCrudLayout";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Branch {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
  image?: string;
  description?: string;
  displayOrder?: number;
  status: string;
  categoryId?: number;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  image?: string;
  status: string;
  displayOrder?: number;
  subcategories?: Subcategory[];
  /** From API list when only _count is returned */
  subcategoryCount?: number;
  branches?: { id: number; name: string }[];
}

function normalizeSubcategoryRow(raw: {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  isActive?: boolean;
  categoryId?: number;
  displayOrder?: number | null;
}): Subcategory {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    image: raw.image ?? undefined,
    displayOrder: raw.displayOrder ?? undefined,
    status: raw.isActive ? "active" : "inactive",
    categoryId: raw.categoryId,
  };
}

function normalizeCategory(raw: {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  displayOrder?: number | null;
  isActive?: boolean;
  status?: string;
  subcategories?: Subcategory[];
  _count?: { subcategories: number };
  branches?: { branch?: { id: number; name: string }; id?: number; name?: string }[];
}): Category {
  const branches = (raw.branches ?? []).map((bb) =>
    bb.branch
      ? { id: bb.branch.id, name: bb.branch.name }
      : { id: bb.id as number, name: bb.name as string }
  );
  const status =
    typeof raw.status === "string"
      ? raw.status
      : raw.isActive
        ? "active"
        : "inactive";
  const subCount =
    raw._count?.subcategories ?? raw.subcategories?.length ?? 0;
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    image: raw.image ?? undefined,
    displayOrder: raw.displayOrder ?? undefined,
    status,
    branches,
    subcategories: raw.subcategories,
    subcategoryCount: subCount,
  };
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

const PAGE_SIZE = 20;

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 });

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catStatus, setCatStatus] = useState(true);
  const [catOrder, setCatOrder] = useState(0);
  const [catBranches, setCatBranches] = useState<number[]>([]);
  const [catImage, setCatImage] = useState<File | null>(null);
  const [catImagePreview, setCatImagePreview] = useState("");

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subParentId, setSubParentId] = useState<number | null>(null);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subOrder, setSubOrder] = useState(0);
  const [subStatus, setSubStatus] = useState(true);
  const [subImage, setSubImage] = useState<File | null>(null);
  const [subImagePreview, setSubImagePreview] = useState("");

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewCategoryName, setViewCategoryName] = useState("");
  const [viewSubs, setViewSubs] = useState<Subcategory[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (searchQuery) params.set("search", searchQuery);
      const res = await apiFetch<unknown>(`/categories?${params.toString()}`);
      const paginated = unwrapPaginated<Parameters<typeof normalizeCategory>[0]>(res);
      if (paginated) {
        setCategories(paginated.data.map((c) => normalizeCategory(c)));
        setMeta({ total: paginated.total, lastPage: paginated.lastPage });
      } else {
        setCategories([]);
        setMeta({ total: 0, lastPage: 1 });
      }
    } catch {
      setCategories([]);
      setMeta({ total: 0, lastPage: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  const fetchBranches = async () => {
    try {
      const data = await apiFetch<unknown>("/branches");
      setBranches(extractBranches(data));
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    void fetchBranches();
  }, []);

  const stats = useMemo(() => {
    const totalSubs = categories.reduce(
      (sum, c) =>
        sum + (c.subcategoryCount ?? c.subcategories?.length ?? 0),
      0
    );
    const active = categories.filter((c) => c.status === "active").length;
    const latest =
      categories.length > 0 ? categories[categories.length - 1].name : "—";
    return { total: meta.total, totalSubs, active, latest };
  }, [categories, meta.total]);

  const openAddCat = () => {
    const nextDisplayOrder =
      categories.length > 0
        ? Math.max(...categories.map((c) => c.displayOrder ?? 0)) + 1
        : 1;
    setEditingCat(null);
    setCatName("");
    setCatDesc("");
    setCatStatus(true);
    setCatOrder(nextDisplayOrder);
    setCatBranches([]);
    setCatImage(null);
    setCatImagePreview("");
    setCatModalOpen(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || "");
    setCatStatus(cat.status === "active");
    setCatOrder(cat.displayOrder || 0);
    setCatBranches(cat.branches?.map((b) => b.id) || []);
    setCatImage(null);
    setCatImagePreview(cat.image || "");
    setCatModalOpen(true);
  };

  const openAddSub = (categoryId: number) => {
    const nextSubOrder =
      viewSubs.length > 0
        ? Math.max(...viewSubs.map((s) => s.displayOrder ?? 0)) + 1
        : 1;
    setSubParentId(categoryId);
    setEditingSub(null);
    setSubName("");
    setSubDesc("");
    setSubOrder(nextSubOrder);
    setSubStatus(true);
    setSubImage(null);
    setSubImagePreview("");
    setSubModalOpen(true);
  };

  const openViewSubcategories = async (cat: Category) => {
    setViewCategoryName(cat.name);
    setViewSubs([]);
    setViewModalOpen(true);
    setViewLoading(true);
    try {
      const d = await apiFetch<{
        subcategories?: {
          id: number;
          name: string;
          description?: string | null;
          image?: string | null;
          isActive?: boolean;
          categoryId?: number;
          displayOrder?: number | null;
        }[];
      }>(`/categories/${cat.id}`);
      setViewSubs((d.subcategories ?? []).map(normalizeSubcategoryRow));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load subcategories"));
      setViewModalOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const handleSaveCat = async () => {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      let imageUrl = editingCat?.image || "";
      if (catImage) {
        const fd = new FormData();
        fd.append("file", catImage);
        const res = await apiUpload("/upload/single", fd);
        imageUrl = res.url || res.path;
      }
      const payload = {
        name: catName,
        description: catDesc,
        isActive: catStatus,
        displayOrder: Number.isFinite(catOrder) ? catOrder : 0,
        branchIds: catBranches,
        image: imageUrl,
      };
      if (editingCat) {
        await apiFetch(`/categories/${editingCat.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setCatModalOpen(false);
      void fetchCategories();
      toast.success(editingCat ? "Category updated" : "Category created");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSub = async () => {
    if (!subName.trim() || !subParentId) return;
    setSaving(true);
    try {
      let imageUrl = editingSub?.image || "";
      if (subImage) {
        const fd = new FormData();
        fd.append("file", subImage);
        const res = await apiUpload("/upload/single", fd);
        imageUrl = res.url || res.path;
      }
      const payload = {
        name: subName,
        description: subDesc,
        displayOrder: Number.isFinite(subOrder) ? subOrder : 0,
        isActive: subStatus,
        image: imageUrl,
      };
      if (editingSub) {
        await apiFetch(`/subcategories/${editingSub.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/categories/${subParentId}/subcategories`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setSubModalOpen(false);
      setEditingSub(null);
      void fetchCategories();
      if (subParentId) {
        try {
          const d = await apiFetch<{
            subcategories?: {
              id: number;
              name: string;
              description?: string | null;
              image?: string | null;
              isActive?: boolean;
              categoryId?: number;
              displayOrder?: number | null;
            }[];
          }>(`/categories/${subParentId}`);
          setViewSubs((d.subcategories ?? []).map(normalizeSubcategoryRow));
        } catch {
          // ignore modal refresh failures; page list is already refreshed
        }
      }
      toast.success(editingSub ? "Subcategory updated" : "Subcategory created");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setSaving(false);
    }
  };

  const openEditSub = (sub: Subcategory) => {
    setEditingSub(sub);
    setSubParentId(sub.categoryId ?? null);
    setSubName(sub.name);
    setSubDesc(sub.description || "");
    setSubOrder(sub.displayOrder ?? 0);
    setSubStatus(sub.status === "active");
    setSubImage(null);
    setSubImagePreview(sub.image || "");
    setSubModalOpen(true);
  };

  const handleDeleteSub = async (sub: Subcategory) => {
    if (!confirm("Are you sure you want to delete this subcategory?")) return;
    try {
      await apiFetch(`/subcategories/${sub.id}`, { method: "DELETE" });
      setViewSubs((prev) => prev.filter((x) => x.id !== sub.id));
      void fetchCategories();
      toast.success("Subcategory deleted");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Delete failed"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      if (categories.length <= 1 && page > 1) setPage((p) => Math.max(1, p - 1));
      else void fetchCategories();
      toast.success("Category deleted");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Delete failed"));
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Category, i: number) => i + 1,
    },
    {
      key: "image",
      label: "Img",
      className: "w-[4.75rem]",
      render: (item: Category) => {
        const src = item.image ? resolveMediaUrl(item.image) : "";
        return src ? (
          <img
            src={src}
            alt=""
            className="h-12 w-12 rounded-xl border border-border/70 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
            <ImageIcon className="h-5 w-5" aria-hidden />
          </div>
        );
      },
    },
    {
      key: "name",
      label: "Name",
      render: (item: Category) => (
        <span className="font-semibold text-foreground">{item.name}</span>
      ),
    },
    {
      key: "subcategories",
      label: "Subcategories",
      render: (item: Category) => (
        <span className="text-muted-foreground">
          {item.subcategoryCount ?? item.subcategories?.length ?? 0}
        </span>
      ),
    },
    {
      key: "displayOrder",
      label: "Display Order",
      render: (item: Category) => item.displayOrder ?? 0,
    },
    {
      key: "status",
      label: "Status",
      render: (item: Category) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Category) => (
        <TableRowActions>
          <TableRowActionButton
            title="View subcategories"
            onClick={() => void openViewSubcategories(item)}
          >
            <Eye className={tableActionIconClassName} aria-hidden />
          </TableRowActionButton>
          <TableRowActionButton title="Edit" onClick={() => openEditCat(item)}>
            <Pencil className={tableActionIconClassName} aria-hidden />
          </TableRowActionButton>
          <TableRowActionButton
            variant="danger"
            title="Delete"
            onClick={() => void handleDelete(item.id)}
          >
            <Trash2 className={tableActionIconClassName} aria-hidden />
          </TableRowActionButton>
          <TableRowActionButton title="Add subcategory" onClick={() => openAddSub(item.id)}>
            <Plus className={tableActionIconClassName} aria-hidden />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={FolderTree}
        title="Categories"
        description="Manage categories and subcategories — paginated list with API search."
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
          onClick={() => void fetchCategories()}
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          Refresh
        </Button>
        <Button
          type="button"
          className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto"
          onClick={openAddCat}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add category
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={Layers}
            title="Overview"
            description="Total categories is server-wide. Subcategories / active / latest are for the current page."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total categories" value={stats.total} icon={FolderTree} />
            <StatCard title="Subcategories (page)" value={stats.totalSubs} icon={Layers} />
            <StatCard title="Active (page)" value={stats.active} icon={CheckCircle} />
            <StatCard title="Latest (page)" value={stats.latest} icon={Star} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={FolderTree}
              title="Category list"
              description={`${PAGE_SIZE} rows per page · search hits the API.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              searchPlaceholder="Search categories…"
            />
            <DataTable columns={columns} data={categories} loading={loading} inventoryStyle />
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

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onOpenChange={setCatModalOpen}
        title={editingCat ? "Edit Category" : "Add Category"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Image</label>
            {catImagePreview && (
              <img
                src={catImagePreview}
                alt="Preview"
                className="w-20 h-20 rounded-lg object-cover mb-2"
              />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCatImage(f);
                  setCatImagePreview(URL.createObjectURL(f));
                }
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Description
            </label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Category description"
            />
          </div>
          {branches.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Branches
              </label>
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={catBranches.includes(b.id)}
                      onChange={() =>
                        setCatBranches((prev) =>
                          prev.includes(b.id)
                            ? prev.filter((x) => x !== b.id)
                            : [...prev, b.id]
                        )
                      }
                      className={inventoryCheckboxClass}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Display Order
            </label>
            <Input
              type="number"
              value={catOrder}
              onChange={(e) => setCatOrder(Number(e.target.value))}
              min={0}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <InventoryStatusSwitch checked={catStatus} onCheckedChange={setCatStatus} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCat}
              disabled={saving || !catName.trim()}
            >
              {saving ? "Saving..." : editingCat ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View subcategories */}
      <Modal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        title={viewCategoryName ? `${viewCategoryName} — Subcategories` : "Subcategories"}
        description="All subcategories under this category"
        className="max-w-2xl"
      >
        {viewLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : viewSubs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
            No subcategories yet. Use the + button on the row to add one.
          </p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Img</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Description</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {viewSubs.map((s, idx) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {s.image ? (
                        <img
                          src={resolveMediaUrl(s.image)}
                          alt={s.name}
                          className="h-9 w-9 rounded-md border border-border/70 object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground">
                          <ImageIcon className="h-4 w-4" aria-hidden />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.displayOrder ?? 0}</td>
                    <td className="px-3 py-2 text-muted-foreground line-clamp-2 max-w-[200px] hidden sm:table-cell">
                      {s.description || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => openEditSub(s)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8"
                          onClick={() => void handleDeleteSub(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Subcategory Modal */}
      <Modal
        open={subModalOpen}
        onOpenChange={setSubModalOpen}
        title={editingSub ? "Edit Subcategory" : "Add Subcategory"}
        description={
          editingSub
            ? "Update subcategory details and image"
            : "Add a subcategory to this category"
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Image</label>
            {subImagePreview && (
              <img
                src={subImagePreview}
                alt="Preview"
                className="w-20 h-20 rounded-lg object-cover mb-2"
              />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setSubImage(f);
                  setSubImagePreview(URL.createObjectURL(f));
                }
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Subcategory name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Description
            </label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              placeholder="Subcategory description"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Display Order</label>
            <Input
              type="number"
              value={subOrder}
              onChange={(e) => setSubOrder(Number(e.target.value))}
              min={0}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <InventoryStatusSwitch checked={subStatus} onCheckedChange={setSubStatus} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSubModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSub}
              disabled={saving || !subName.trim()}
            >
              {saving ? "Saving..." : editingSub ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

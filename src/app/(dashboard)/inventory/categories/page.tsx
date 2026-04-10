"use client";

import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
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
  status: string;
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
}): Subcategory {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    image: raw.image ?? undefined,
    status: raw.isActive ? "active" : "inactive",
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subStatus, setSubStatus] = useState(true);
  const [subImage, setSubImage] = useState<File | null>(null);
  const [subImagePreview, setSubImagePreview] = useState("");

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewCategoryName, setViewCategoryName] = useState("");
  const [viewSubs, setViewSubs] = useState<Subcategory[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<
        | { data: Parameters<typeof normalizeCategory>[0][]; total?: number }
        | { categories: Category[] }
      >("/categories?limit=500");
      const list = Array.isArray(res)
        ? res
        : "data" in res && Array.isArray(res.data)
          ? res.data
          : "categories" in res
            ? res.categories
            : [];
      setCategories(list.map((c) => normalizeCategory(c)));
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await apiFetch<Branch[] | { branches: Branch[] }>("/branches");
      setBranches(Array.isArray(data) ? data : data.branches ?? []);
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBranches();
  }, []);

  const filtered = useMemo(
    () =>
      categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      ),
    [categories, search]
  );

  const stats = useMemo(() => {
    const totalSubs = categories.reduce(
      (sum, c) =>
        sum +
        (c.subcategoryCount ?? c.subcategories?.length ?? 0),
      0
    );
    const active = categories.filter((c) => c.status === "active").length;
    const latest =
      categories.length > 0 ? categories[categories.length - 1].name : "N/A";
    return { total: categories.length, totalSubs, active, latest };
  }, [categories]);

  const openAddCat = () => {
    setEditingCat(null);
    setCatName("");
    setCatDesc("");
    setCatStatus(true);
    setCatOrder(0);
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
    setSubParentId(categoryId);
    setSubName("");
    setSubDesc("");
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
        }[];
      }>(`/categories/${cat.id}`);
      setViewSubs((d.subcategories ?? []).map(normalizeSubcategoryRow));
    } catch (err: any) {
      toast.error(err.message || "Failed to load subcategories");
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
        displayOrder: catOrder,
        branchIds: catBranches,
        image: imageUrl,
      };
      if (editingCat) {
        await apiFetch(`/categories/${editingCat.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setCatModalOpen(false);
      fetchCategories();
      toast.success(editingCat ? "Category updated" : "Category created");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSub = async () => {
    if (!subName.trim() || !subParentId) return;
    setSaving(true);
    try {
      let imageUrl = "";
      if (subImage) {
        const fd = new FormData();
        fd.append("file", subImage);
        const res = await apiUpload("/upload/single", fd);
        imageUrl = res.url || res.path;
      }
      await apiFetch(`/categories/${subParentId}/subcategories`, {
        method: "POST",
        body: JSON.stringify({
          name: subName,
          description: subDesc,
          isActive: subStatus,
          image: imageUrl,
        }),
      });
      setSubModalOpen(false);
      fetchCategories();
      toast.success("Subcategory created");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      fetchCategories();
      toast.success("Category deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
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
      label: "Image",
      className: "w-16",
      render: (item: Category) =>
        item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon size={16} className="text-muted-foreground" />
          </div>
        ),
    },
    { key: "name", label: "Name" },
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
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            title="View subcategories"
            onClick={() => openViewSubcategories(item)}
          >
            <Eye size={14} className="text-blue-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditCat(item)}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 size={14} className="text-red-500" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openAddSub(item.id)}>
            <Plus size={14} className="text-orange-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Category Management"
        description="Manage product categories and subcategories"
        action={
          <Button onClick={openAddCat}>
            <Plus size={16} className="mr-2" /> Add Category
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Categories"
          value={stats.total}
          icon={FolderTree}
        />
        <StatCard
          title="Total Subcategories"
          value={stats.totalSubs}
          icon={Layers}
        />
        <StatCard title="Active" value={stats.active} icon={CheckCircle} />
        <StatCard title="Latest" value={stats.latest} icon={Star} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search categories..."
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

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
                      className="accent-orange-500"
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
            <button
              type="button"
              onClick={() => setCatStatus(!catStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${catStatus ? "bg-orange-500" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${catStatus ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
            <span className="ml-2 text-sm">
              {catStatus ? "Active" : "Inactive"}
            </span>
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
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Description</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {viewSubs.map((s, idx) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground line-clamp-2 max-w-[200px] hidden sm:table-cell">
                      {s.description || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.status} />
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
        title="Add Subcategory"
        description="Add a subcategory to this category"
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
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <button
              type="button"
              onClick={() => setSubStatus(!subStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${subStatus ? "bg-orange-500" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subStatus ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
            <span className="ml-2 text-sm">
              {subStatus ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSubModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSub}
              disabled={saving || !subName.trim()}
            >
              {saving ? "Saving..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

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
} from "lucide-react";
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
  branches?: { id: number; name: string }[];
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

  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ categories: Category[] }>("/categories");
      setCategories(data.categories || []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await apiFetch<{ branches: Branch[] }>("/branches");
      setBranches(data.branches || []);
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
      (sum, c) => sum + (c.subcategories?.length || 0),
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

  const handleSaveCat = async () => {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      let imageUrl = editingCat?.image || "";
      if (catImage) {
        const fd = new FormData();
        fd.append("file", catImage);
        const res = await apiUpload("/upload", fd);
        imageUrl = res.url || res.path;
      }
      const payload = {
        name: catName,
        description: catDesc,
        status: catStatus ? "active" : "inactive",
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
    } catch (err: any) {
      alert(err.message);
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
        const res = await apiUpload("/upload", fd);
        imageUrl = res.url || res.path;
      }
      await apiFetch(`/categories/${subParentId}/subcategories`, {
        method: "POST",
        body: JSON.stringify({
          name: subName,
          description: subDesc,
          status: subStatus ? "active" : "inactive",
          image: imageUrl,
        }),
      });
      setSubModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      fetchCategories();
    } catch (err: any) {
      alert(err.message);
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
          {item.subcategories?.length || 0}
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
        <div className="flex items-center gap-1">
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

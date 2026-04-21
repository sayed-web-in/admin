"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Tags,
  CheckCircle,
  XCircle,
  Star,
  Pencil,
  Trash2,
  Plus,
  ImageIcon,
  RotateCcw,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api";
import {
  extractApiList,
  extractBranches,
  unwrapPaginated,
} from "@/lib/apiList";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { resolveMediaUrl } from "@/app/(dashboard)/inventory/add-product/media";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
  InventoryStatusSwitch,
  inventoryCheckboxClass,
} from "@/components/inventory/InventoryCrudLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Branch {
  id: number;
  name: string;
}

interface Brand {
  id: number;
  name: string;
  description?: string;
  image?: string;
  status: string;
  branches?: { id: number; name: string }[];
}

function normalizeBrand(raw: {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  isActive?: boolean;
  status?: string;
  branches?: { branch?: { id: number; name: string }; id?: number; name?: string }[];
}): Brand {
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
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    image: raw.image ?? undefined,
    status,
    branches,
  };
}

const PAGE_SIZE = 20;

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [formBranches, setFormBranches] = useState<number[]>([]);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (searchQuery) params.set("search", searchQuery);
      const res = await apiFetch<unknown>(`/brands?${params.toString()}`);
      const paginated = unwrapPaginated<Parameters<typeof normalizeBrand>[0]>(res);
      if (paginated) {
        setBrands(paginated.data.map((b) => normalizeBrand(b)));
        setMeta({ total: paginated.total, lastPage: paginated.lastPage });
      } else {
        const list = extractApiList<Parameters<typeof normalizeBrand>[0]>(res, [
          "brands",
        ]);
        setBrands(list.map((b) => normalizeBrand(b)));
        setMeta({ total: list.length, lastPage: 1 });
      }
    } catch {
      setBrands([]);
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
    void fetchBrands();
  }, [fetchBrands]);

  useEffect(() => {
    void fetchBranches();
  }, []);

  const stats = useMemo(() => {
    const active = brands.filter((b) => b.status === "active").length;
    const inactive = brands.length - active;
    const latest = brands.length > 0 ? brands[brands.length - 1].name : "—";
    return { total: meta.total, active, inactive, latest };
  }, [brands, meta.total]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setFormStatus(true);
    setFormBranches([]);
    setFormImage(null);
    setFormImagePreview("");
    setModalOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setFormName(brand.name);
    setFormDesc(brand.description || "");
    setFormStatus(brand.status === "active");
    setFormBranches(brand.branches?.map((b) => b.id) || []);
    setFormImage(null);
    setFormImagePreview(brand.image || "");
    setModalOpen(true);
  };

  const toggleBranch = (id: number) => {
    setFormBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormImage(file);
      setFormImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      let imageUrl = editing?.image || "";
      if (formImage) {
        const fd = new FormData();
        fd.append("file", formImage);
        const res = await apiUpload("/upload/single", fd);
        imageUrl = res.url || res.path;
      }

      const payload = {
        name: formName,
        description: formDesc,
        isActive: formStatus,
        branchIds: formBranches,
        image: imageUrl,
      };

      if (editing) {
        await apiFetch(`/brands/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/brands", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await fetchBrands();
      toast.success(editing ? "Brand updated" : "Brand created");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this brand?")) return;
    try {
      await apiFetch(`/brands/${id}`, { method: "DELETE" });
      if (brands.length <= 1 && page > 1) setPage((p) => Math.max(1, p - 1));
      else void fetchBrands();
      toast.success("Brand deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Brand, i: number) => i + 1,
    },
    {
      key: "image",
      label: "Img",
      className: "w-[4.75rem]",
      render: (item: Brand) => {
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
      render: (item: Brand) => (
        <span className="font-semibold text-foreground">{item.name}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (item: Brand) => (
        <span className="text-muted-foreground line-clamp-1">
          {item.description || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Brand) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Brand) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(item)}>
            <Pencil className={tableActionIconClassName} aria-hidden />
          </TableRowActionButton>
          <TableRowActionButton
            variant="danger"
            title="Delete"
            onClick={() => handleDelete(item.id)}
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
        icon={Tags}
        title="Brands"
        description="Create and assign brands to branches — shared layout with other inventory settings."
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
          onClick={() => void fetchBrands()}
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
          Add brand
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Total is server-wide. Active / inactive / latest are for the current page only."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total brands" value={stats.total} icon={Tags} />
            <StatCard title="Active" value={stats.active} icon={CheckCircle} />
            <StatCard title="Inactive" value={stats.inactive} icon={XCircle} />
            <StatCard title="Latest" value={stats.latest} icon={Star} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Tags}
              title="Brand list"
              description={`Paginated (${PAGE_SIZE} per page). Search is sent to the API.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              searchPlaceholder="Search brands…"
            />
            <DataTable
              columns={columns}
              data={brands}
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
        title={editing ? "Edit Brand" : "Add Brand"}
        description={editing ? "Update brand details" : "Create a new brand"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Image</label>
            {formImagePreview && (
              <img
                src={formImagePreview}
                alt="Preview"
                className="mb-2 h-20 w-20 rounded-lg object-cover"
              />
            )}
            <Input type="file" accept="image/*" onChange={handleImageChange} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Brand Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter brand name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Brand description"
            />
          </div>
          {branches.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Branches</label>
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={formBranches.includes(b.id)}
                      onChange={() => toggleBranch(b.id)}
                      className={inventoryCheckboxClass}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <InventoryStatusSwitch checked={formStatus} onCheckedChange={setFormStatus} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

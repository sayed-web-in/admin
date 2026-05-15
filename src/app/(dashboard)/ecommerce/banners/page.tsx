"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  LayoutGrid,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { apiFetch, apiUpload } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
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

interface Banner {
  id: number;
  title: string;
  image: string;
  link?: string;
  type: "HERO_LARGE" | "HERO_SMALL" | "MIDDLE_LEFT" | "MIDDLE_RIGHT";
  isActive: boolean;
  sortOrder?: number;
}

/** Matches frontend storefront slots (`HeroBannerClient`, `MiddleBanners`). */
const BANNER_SIZE_BY_TYPE: Record<
  Banner["type"],
  { label: string; size: string; hint: string; previewClass: string }
> = {
  HERO_LARGE: {
    label: "Hero Large",
    size: "856 × 400 px",
    hint: "Homepage hero slider (left, ~70% width). Use exact ratio 856:400.",
    previewClass: "aspect-[856/400]",
  },
  HERO_SMALL: {
    label: "Hero Small",
    size: "374 × 196 px",
    hint: "Homepage hero side (right column, max 2 banners). If only one small banner is active, frontend may show 374 × 400 px.",
    previewClass: "aspect-[374/196]",
  },
  MIDDLE_LEFT: {
    label: "Middle Left",
    size: "616 × 225 px",
    hint: "Homepage middle section — left half (desktop).",
    previewClass: "aspect-[616/225]",
  },
  MIDDLE_RIGHT: {
    label: "Middle Right",
    size: "616 × 225 px",
    hint: "Homepage middle section — right half (desktop).",
    previewClass: "aspect-[616/225]",
  },
};

const POSITION_OPTIONS = (
  Object.entries(BANNER_SIZE_BY_TYPE) as [Banner["type"], (typeof BANNER_SIZE_BY_TYPE)[Banner["type"]]][]
).map(([value, meta]) => ({
  value,
  label: `${meta.label} — ${meta.size}`,
}));

const INPUT_CLS =
  "w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary";
const LABEL_CLS = "block text-sm font-medium text-foreground mb-1";

const MAX_HERO_SMALL = 2;

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formType, setFormType] = useState<Banner["type"]>("HERO_LARGE");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Banner[] | { data?: Banner[] }>("/banners");
      const list = Array.isArray(res) ? res : res.data || [];
      setBanners(Array.isArray(list) ? list : []);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBanners();
  }, [fetchBanners]);

  const heroSmallCountExcludingEditing = useMemo(
    () =>
      banners.filter((b) => b.type === "HERO_SMALL" && (!editing || b.id !== editing.id)).length,
    [banners, editing],
  );

  const heroSmallTypeDisabled =
    heroSmallCountExcludingEditing >= MAX_HERO_SMALL && editing?.type !== "HERO_SMALL";

  const selectedSizeMeta = BANNER_SIZE_BY_TYPE[formType];

  const openCreate = () => {
    setEditing(null);
    setFormTitle("");
    setFormLink("");
    setFormType("HERO_LARGE");
    setFormIsActive(true);
    setFormImage(null);
    setFormImagePreview("");
    setFormImageUrl("");
    setModalOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setEditing(banner);
    setFormTitle(banner.title);
    setFormLink(banner.link ?? "");
    setFormType(banner.type ?? "HERO_LARGE");
    setFormIsActive(banner.isActive);
    setFormImage(null);
    setFormImagePreview(banner.image);
    setFormImageUrl(banner.image);
    setModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormImage(file);
    setFormImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { toast.error("Title is required"); return; }
    if (!formImageUrl && !formImage) { toast.error("Image is required"); return; }
    if (
      formType === "HERO_SMALL" &&
      heroSmallCountExcludingEditing >= MAX_HERO_SMALL &&
      editing?.type !== "HERO_SMALL"
    ) {
      toast.error(`Hero Small banners: maximum ${MAX_HERO_SMALL} allowed`);
      return;
    }
    setSaving(true);
    try {
      let imageUrl = formImageUrl;
      if (formImage) {
        const fd = new FormData();
        fd.append("file", formImage);
        const uploaded = await apiUpload("/upload/banner-image", fd);
        imageUrl = uploaded?.data?.url ?? uploaded?.url ?? "";
        if (!imageUrl) throw new Error("Image upload failed");
      }
      const payload = {
        title: formTitle.trim(),
        image: imageUrl,
        link: formLink.trim() || undefined,
        type: formType,
        isActive: formIsActive,
      };
      if (editing) {
        await apiFetch(`/banners/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Banner updated");
      } else {
        await apiFetch("/banners", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Banner created");
      }
      setModalOpen(false);
      void fetchBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (banner: Banner) => {
    try {
      await apiFetch(`/banners/${banner.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      toast.success(`Banner ${banner.isActive ? "deactivated" : "activated"}`);
      void fetchBanners();
    } catch {
      toast.error("Failed to toggle status");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this banner?")) return;
    try {
      await apiFetch(`/banners/${id}`, { method: "DELETE" });
      toast.success("Banner deleted");
      void fetchBanners();
    } catch {
      toast.error("Delete failed");
    }
  };

  const filtered = banners.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.type ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = banners.filter((b) => b.isActive).length;
  const inactiveCount = banners.filter((b) => !b.isActive).length;

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Banner, i: number) => i + 1,
    },
    {
      key: "image",
      label: "Image",
      className: "w-[4.75rem]",
      render: (row: Banner) =>
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
      label: "Title",
      render: (row: Banner) => (
        <div>
          <p className="font-semibold text-foreground">{row.title}</p>
          {row.link && <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{row.link}</p>}
        </div>
      ),
    },
    {
      key: "position",
      label: "Position",
      render: (row: Banner) => {
        const meta = row.type ? BANNER_SIZE_BY_TYPE[row.type] : null;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {meta?.label ?? row.type ?? "—"}
            </span>
            {meta?.size && (
              <span className="text-[11px] text-muted-foreground tabular-nums">{meta.size}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "sortOrder",
      label: "Order",
      render: (row: Banner) => (
        <span className="text-sm text-muted-foreground">{row.sortOrder ?? 0}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: Banner) => <StatusBadge status={row.isActive ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: Banner) => (
        <TableRowActions>
          <TableRowActionButton
            title={row.isActive ? "Deactivate" : "Activate"}
            onClick={() => handleToggle(row)}
          >
            {row.isActive ? (
              <ToggleRight className={tableActionIconClassName} />
            ) : (
              <ToggleLeft className={tableActionIconClassName} />
            )}
          </TableRowActionButton>
          <TableRowActionButton title="Edit" onClick={() => openEdit(row)}>
            <Pencil className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton variant="danger" title="Delete" onClick={() => handleDelete(row.id)}>
            <Trash2 className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={ImageIcon}
        title="Banners"
        description="Create and manage ecommerce banners for different positions."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => void fetchBanners()}
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
          Add Banner
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        {/* Stats */}
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Summary of all banners across positions."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Banners" value={banners.length} icon={ImageIcon} />
            <StatCard title="Active" value={activeCount} icon={CheckCircle} />
            <StatCard title="Inactive" value={inactiveCount} icon={XCircle} />
          </div>
        </section>

        {/* Table */}
        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={ImageIcon}
              title="Banner list"
              description={`${filtered.length} banner${filtered.length !== 1 ? "s" : ""} found`}
            />
          </div>
          <div className="p-5 sm:p-6">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by title or type..."
            />
            <DataTable columns={columns} data={filtered} loading={loading} />
          </div>
        </section>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Banner" : "Add Banner"}
        icon={<ImageIcon className="w-5 h-5" />}
        size="md"
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
          {/* Image */}
          <div>
            <label className={LABEL_CLS}>Banner Image *</label>
            <p className="mb-2 text-xs text-muted-foreground">
              Recommended:{" "}
              <span className="font-semibold text-foreground tabular-nums">{selectedSizeMeta.size}</span>{" "}
              ({selectedSizeMeta.label})
            </p>
            <div className="flex items-start gap-3">
              <div
                className={`relative w-40 rounded-xl border border-border bg-muted overflow-hidden flex-shrink-0 ${selectedSizeMeta.previewClass}`}
              >
                {formImagePreview ? (
                  <Image
                    src={resolveMediaUrl(formImagePreview)}
                    alt="preview"
                    fill
                    className="object-cover"
                    sizes="160px"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon size={24} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="text-sm text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={LABEL_CLS}>Title *</label>
            <input className={INPUT_CLS} placeholder="Banner title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          </div>

          {/* Link */}
          <div>
            <label className={LABEL_CLS}>Link (optional)</label>
            <Input
              className={INPUT_CLS}
              placeholder="https://example.com"
              value={formLink}
              onChange={(e) => setFormLink(e.target.value)}
            />
          </div>

          {/* Type */}
          <div>
            <label className={LABEL_CLS}>
              Type{" "}
              <span className="font-normal text-muted-foreground tabular-nums">({selectedSizeMeta.size})</span>
            </label>
            <select
              className={INPUT_CLS}
              value={formType}
              onChange={(e) => setFormType(e.target.value as Banner["type"])}
            >
              {POSITION_OPTIONS.map((p) => (
                <option
                  key={p.value}
                  value={p.value}
                  disabled={p.value === "HERO_SMALL" && heroSmallTypeDisabled}
                >
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Storefront:</span> {selectedSizeMeta.hint}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hero Small: at most {MAX_HERO_SMALL} active banners on the homepage.
            </p>
          </div>

          {/* Status toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active Status</p>
              <p className="text-xs text-muted-foreground">Show this banner on the site</p>
            </div>
            <button
              type="button"
              onClick={() => setFormIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formIsActive ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formIsActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

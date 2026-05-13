"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Image as ImageIconLucide,
  AlertTriangle,
  Layers,
  Loader2,
  Package,
  Pencil,
  RefreshCcw,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { resolveMediaUrl } from "@/app/(dashboard)/inventory/add-product/media";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BatchModal } from "@/components/inventory/BatchModal";

interface SpecRow {
  name: string;
  value: string;
}

interface ProductDetail {
  id: number;
  name: string;
  type: string;
  sku?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  unitName?: string;
  taxLabel?: string;
  status: string;
  description?: string;
  images: string[];
  hasImei?: boolean;
  specifications: SpecRow[];
  createdAt?: string;
  updatedAt?: string;
}

interface BranchVariant {
  id: number;
  branchName: string;
  image?: string;
  variantLabel?: string;
  quantity: number;
  sellingPrice: number;
  date: string;
  quantityAlert?: number;
}

const labelClass =
  "shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground";

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(s);
}

function formatProductType(t: string): string {
  const x = String(t || "").toLowerCase();
  if (x === "single") return "Single";
  if (x === "variable") return "Variable";
  return t;
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [branchVariants, setBranchVariants] = useState<BranchVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedBvId, setSelectedBvId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [raw, vRes] = await Promise.all([
        apiFetch<Record<string, unknown>>(`/products/${id}`),
        apiFetch<{ variants: BranchVariant[] }>(`/products/${id}/branch-variants`),
      ]);
      const variants = vRes.variants || [];
      const p = raw as {
        id: number;
        name: string;
        type: string;
        sku?: string | null;
        category?: { name: string } | null;
        subCategory?: { name: string } | null;
        brand?: { name: string } | null;
        unit?: { name: string } | null;
        taxRate?: { name: string; rate?: number | string } | null;
        status: string;
        description?: string | null;
        images?: { url: string }[];
        hasImei?: boolean;
        specifications?: { name: string; value: string }[];
        createdAt?: string;
        updatedAt?: string;
      };
      const tax = p.taxRate;
      const taxLabel =
        tax && (tax.name != null || tax.rate != null)
          ? [tax.name, tax.rate != null && tax.rate !== "" ? `${tax.rate}%` : null].filter(Boolean).join(" · ")
          : undefined;

      setProduct({
        id: p.id,
        name: p.name,
        type: p.type,
        sku: p.sku ?? undefined,
        categoryName: p.category?.name,
        subCategoryName: p.subCategory?.name,
        brandName: p.brand?.name,
        unitName: p.unit?.name,
        taxLabel,
        status: p.status,
        description: p.description ?? undefined,
        images: (p.images ?? []).map((i) => i.url).filter(Boolean),
        hasImei: p.hasImei,
        specifications: Array.isArray(p.specifications)
          ? p.specifications.map((s) => ({ name: String(s.name ?? ""), value: String(s.value ?? "") }))
          : [],
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
      setBranchVariants(variants);
      setActiveImageIndex(0);
    } catch {
      setProduct(null);
      setBranchVariants([]);
      setError("Could not load this product.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const allImageUrls = useMemo(() => {
    if (!product) return [];
    const fromProduct = product.images.map((u) => resolveMediaUrl(u));
    const fromVariants = branchVariants
      .map((v) => (v.image ? resolveMediaUrl(v.image) : ""))
      .filter(Boolean);
    return Array.from(new Set([...fromProduct, ...fromVariants]));
  }, [product, branchVariants]);

  useEffect(() => {
    setActiveImageIndex((i) => {
      if (allImageUrls.length === 0) return 0;
      return Math.min(i, allImageUrls.length - 1);
    });
  }, [allImageUrls.length]);

  const openBatch = (bvId: number) => {
    setSelectedBvId(bvId);
    setBatchModalOpen(true);
  };

  const variantColumns = useMemo(
    () => [
      {
        key: "index",
        label: "#",
        className: "w-10",
        render: (_: BranchVariant, i: number) => i + 1,
      },
      { key: "branchName", label: "Branch" },
      {
        key: "image",
        label: "Image",
        className: "w-14",
        render: (item: BranchVariant) =>
          item.image ? (
            <img
              src={resolveMediaUrl(item.image)}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <ImageIconLucide size={14} className="text-muted-foreground" />
            </div>
          ),
      },
      {
        key: "variantLabel",
        label: "Variant",
        render: (item: BranchVariant) => item.variantLabel || "Default",
      },
      { key: "quantity", label: "Qty" },
      {
        key: "sellingPrice",
        label: "Price",
        render: (item: BranchVariant) => formatPrice(item.sellingPrice),
      },
      {
        key: "date",
        label: "Date",
        render: (item: BranchVariant) => formatDate(item.date),
      },
      {
        key: "lowStock",
        label: "Stock alert",
        render: (item: BranchVariant) => {
          if (item.quantityAlert && item.quantity <= item.quantityAlert) {
            return (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle size={12} /> Low
              </Badge>
            );
          }
          return <Badge variant="success">OK</Badge>;
        },
      },
      {
        key: "actions",
        label: "Batches",
        render: (item: BranchVariant) => (
          <Button variant="ghost" size="sm" onClick={() => openBatch(item.id)}>
            <Layers size={14} className="mr-1" /> Batches
          </Button>
        ),
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] w-full min-w-0 items-center justify-center gap-2 pb-8 pt-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading product…
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
        <InventoryListPageHeader
          icon={Package}
          title="Product"
          description={error || "Not found"}
        >
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
            <Link href="/inventory/manage-product">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </InventoryListPageHeader>
        <section className={`${INVENTORY_CARD_SHELL} p-6`}>
          <p className="text-sm text-destructive">{error || "This product does not exist or was removed."}</p>
        </section>
      </div>
    );
  }

  const safeImgIdx =
    allImageUrls.length > 0 ? Math.min(activeImageIndex, allImageUrls.length - 1) : 0;
  const mainImageSrc = allImageUrls.length > 0 ? allImageUrls[safeImgIdx] : null;

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Package}
        title={product.name}
        description="Product information, details, and branch inventory — aligned with seller-admin view."
      >
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
          <Link href="/inventory/manage-product">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 rounded-xl sm:h-9"
          onClick={() => void load()}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button type="button" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
          <Link href={`/inventory/add-product?mode=edit&productId=${product.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit product
          </Link>
        </Button>
      </InventoryListPageHeader>

      {/* Seller-admin style: two columns — Product Information | Product Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 px-5 py-4 sm:px-6">
            <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Package className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              Product Information
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Basic details, category, brand and unit</p>
          </div>
          <div className="divide-y divide-border/60 px-5 py-1 sm:px-6">
            <div className="flex items-start justify-between gap-4 py-3 first:pt-3">
              <span className={labelClass}>Product</span>
              <p className="text-right text-sm font-medium text-foreground">{product.name}</p>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className={labelClass}>Product type</span>
              <Badge variant={product.type === "VARIABLE" ? "warning" : "secondary"} className="capitalize">
                {formatProductType(product.type)}
              </Badge>
            </div>
            {product.sku ? (
              <div className="flex items-start justify-between gap-4 py-3">
                <span className={labelClass}>SKU</span>
                <p className="break-all text-right font-mono text-sm font-medium text-foreground">{product.sku}</p>
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-4 py-3">
              <span className={labelClass}>Category</span>
              <p className="text-right text-sm text-foreground">{product.categoryName || "—"}</p>
            </div>
            {product.subCategoryName ? (
              <div className="flex items-start justify-between gap-4 py-3">
                <span className={labelClass}>Subcategory</span>
                <p className="text-right text-sm text-foreground">{product.subCategoryName}</p>
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-4 py-3">
              <span className={labelClass}>Brand</span>
              <p className="text-right text-sm text-foreground">{product.brandName || "—"}</p>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <span className={labelClass}>Unit</span>
              <p className="text-right text-sm text-foreground">{product.unitName || "—"}</p>
            </div>
            {product.taxLabel ? (
              <div className="flex items-start justify-between gap-4 py-3">
                <span className={labelClass}>Tax rate</span>
                <p className="text-right text-sm text-foreground">{product.taxLabel}</p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 py-3">
              <span className={labelClass}>IMEI / serial</span>
              <p className="text-sm font-medium text-foreground">{product.hasImei ? "Yes" : "No"}</p>
            </div>
            {product.createdAt ? (
              <div className="flex items-center justify-between gap-4 py-3">
                <span className={labelClass}>Created</span>
                <p className="flex items-center gap-2 text-right text-sm text-foreground">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {formatDate(product.createdAt)}
                </p>
              </div>
            ) : null}
            {product.updatedAt ? (
              <div className="flex items-center justify-between gap-4 py-3">
                <span className={labelClass}>Updated</span>
                <p className="flex items-center gap-2 text-right text-sm text-foreground">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {formatDate(product.updatedAt)}
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 py-3 last:pb-3">
              <span className={labelClass}>Status</span>
              <StatusBadge status={product.status} />
            </div>
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 px-5 py-4 sm:px-6">
            <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
              <ImageIconLucide className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              Product Details
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Photos, description and specifications</p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            {mainImageSrc ? (
              <div className="space-y-3">
                <div className="relative mb-1 h-64 w-full overflow-hidden rounded-xl border border-border bg-muted md:h-80">
                  <img src={mainImageSrc} alt={product.name} className="h-full w-full object-cover" />
                </div>
                {allImageUrls.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {allImageUrls.map((src, idx) => (
                      <button
                        key={`${src}-${idx}`}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative h-16 w-16 overflow-hidden rounded-md border bg-muted transition-[box-shadow,border-color] ${
                          idx === safeImgIdx
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mb-1 rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center">
                <ImageIconLucide className="mx-auto mb-3 h-14 w-14 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">No image</p>
              </div>
            )}

            {product.description ? (
              <div>
                <p className={labelClass}>Description</p>
                {looksLikeHtml(product.description) ? (
                  <div
                    className="mt-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-sm text-foreground [&_a]:text-primary [&_img]:max-h-48 [&_img]:rounded-md [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                ) : (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/30 p-3 text-sm text-foreground">
                    {product.description}
                  </p>
                )}
              </div>
            ) : null}

            {product.specifications.length > 0 ? (
              <div>
                <p className={labelClass}>Specifications</p>
                <div className="mt-2 divide-y divide-border/60 rounded-lg border border-border/50 bg-muted/20">
                  {product.specifications.map((row, i) => (
                    <div key={i} className="flex justify-between gap-4 px-3 py-2.5 text-sm">
                      <span className="font-medium text-foreground">{row.name}</span>
                      <span className="max-w-[60%] text-right text-muted-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6">
          <InventorySectionHeader
            compact
            icon={Layers}
            title="Branch inventory"
            description="Per-branch stock, pricing, and batch drill-down."
          />
        </div>
        <div className="p-4 sm:p-5">
          <DataTable columns={variantColumns} data={branchVariants} loading={false} inventoryStyle />
        </div>
      </section>

      <BatchModal
        open={batchModalOpen}
        onOpenChange={setBatchModalOpen}
        branchProductVariantId={selectedBvId}
      />
    </div>
  );
}

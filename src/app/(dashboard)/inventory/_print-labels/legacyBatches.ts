import { apiFetch } from "@/lib/api";
import { unwrapPaginated } from "@/lib/apiList";

/** Legacy Nest API uses integer IDs (MySQL-style); Saas uses cuid strings. */
export function looksLikeLegacyNumericIds(a: string, b: string, c: string): boolean {
  return /^[0-9]+$/.test(a) && /^[0-9]+$/.test(b) && /^[0-9]+$/.test(c);
}

function variantMatchesStoreRow(
  productVariantId: number | null | undefined,
  requestedVariantId: string
): boolean {
  const req = String(requestedVariantId);
  const spv = productVariantId == null ? null : Number(productVariantId);
  if (req === "0") {
    return spv == null || spv === 0;
  }
  return spv === Number(req);
}

type StoreRowLite = {
  id: number;
  productId: number;
  productVariantId?: number | null;
};

/**
 * Paginates GET /products/store until a row matches product + variant + branch filter.
 */
export async function resolveLegacyStoreProductId(
  productId: string,
  variantId: string,
  branchId: string
): Promise<string | null> {
  const wantPid = Number(productId);
  let page = 1;
  const limit = 100;
  const maxPages = 80;

  while (page <= maxPages) {
    const qs = new URLSearchParams({
      branchId,
      page: String(page),
      limit: String(limit),
    });
    const res = await apiFetch<unknown>(`/products/store?${qs.toString()}`);
    const paged = unwrapPaginated<StoreRowLite>(res);
    if (!paged) return null;

    const hit = paged.data.find(
      (sp) =>
        Number(sp.productId) === wantPid &&
        variantMatchesStoreRow(sp.productVariantId, variantId)
    );
    if (hit) return String(hit.id);

    if (page >= paged.lastPage) break;
    page += 1;
  }
  return null;
}

export type LegacyBatchRow = {
  id: number | string;
  batchNumber?: string;
  barcode?: string | null;
  availableQty?: number;
  availableQuantity?: number;
};

export function mapLegacyBatchToApi(
  b: LegacyBatchRow,
  productId: string,
  variantId: string
): {
  id: string;
  batchNumber: string;
  barcode?: string | null;
  productId: string;
  variantId: string;
  availableQuantity: number;
  product?: { name?: string };
  variant?: { sku?: string };
} {
  const avail = Number(
    b.availableQty ?? b.availableQuantity ?? 0
  );
  return {
    id: String(b.id),
    batchNumber: String(b.batchNumber ?? ""),
    barcode: b.barcode ?? null,
    productId,
    variantId,
    availableQuantity: Number.isFinite(avail) ? avail : 0,
    product: { name: "" },
    variant: { sku: "" },
  };
}

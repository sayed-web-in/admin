import type { ProductFormState } from "./types";

export function hasDescriptionText(html: string): boolean {
  if (!html || !html.trim()) return false;
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return stripped.length > 0;
}

export function isProductInfoValid(
  form: Pick<
    ProductFormState,
    | "name"
    | "branchId"
    | "categoryId"
    | "brandId"
    | "unitId"
    | "productType"
    | "sku"
  >
): boolean {
  return (
    !!form.name.trim() &&
    form.branchId > 0 &&
    form.categoryId > 0 &&
    form.brandId > 0 &&
    form.unitId > 0 &&
    (form.productType === "variable" || !!form.sku.trim())
  );
}

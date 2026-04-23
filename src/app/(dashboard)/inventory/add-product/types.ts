import type { VariantEntry } from "@/components/inventory/VariantModal";

/** Same labels as seller-admin PRODUCT_TYPES */
export const PRODUCT_TYPES = [
  { value: "single" as const, label: "Single Product" },
  { value: "variable" as const, label: "Variable Product" },
];

/** Same as seller-admin SERIAL_NUMBER_OPTIONS — string values for Radix Select */
export const SERIAL_NUMBER_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
] as const;

export interface StoreProductRow {
  storeProductId: number;
  productId: number;
  branch: { id: number; name: string };
  variantId: number | null;
  variantLabel: string;
  sku: string;
  quantity: number;
  quantityAlert: number;
  purchaseCostPerUnit: number;
  sellingPrice: number;
  discountType: string;
  discountValue: number;
  sellingType: string;
  createdAt: string;
  serialNumbers: string[];
  canEditPurchaseCost: boolean;
}

export interface ProductFormState {
  name: string;
  description: string;
  productType: "single" | "variable";
  branchId: number;
  categoryId: number;
  subcategoryId: number;
  brandId: number;
  unitId: number;
  taxRateId: number;
  sku: string;
  hasSerialNumber: boolean;
  images: string[];
  pendingImages: Array<{ tempUrl: string; file: File }>;
  specifications: { name: string; value: string }[];
  variants: VariantEntry[];
}

export type { VariantEntry };

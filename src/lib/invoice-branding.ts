import { apiFetch } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import type { InvoiceBranding } from "@/lib/invoice-print";

export async function fetchInvoiceBranding(): Promise<InvoiceBranding> {
  try {
    const res = await apiFetch<{
      headerBrand?: {
        brandName?: string;
        brandLogoUrl?: string;
        mode?: string;
      };
    }>("/storefront-settings/public");
    const header = res?.headerBrand;
    const brandName = String(header?.brandName ?? "").trim();
    const logoRaw = String(header?.brandLogoUrl ?? "").trim();
    const logoUrl = logoRaw ? resolveMediaUrl(logoRaw) : undefined;
    return { brandName: brandName || undefined, logoUrl };
  } catch {
    return {};
  }
}

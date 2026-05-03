export type NoteRow = {
  productName: string;
  sellingPrice: number;
  variantDisplay: string;
  sku: string;
  brandId?: string | null;
};

function formatMoneyTk(value: number): string {
  const formatted = Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted.replace(/\.00$/, "")}tk`;
}

/** Merge rows by same productName + sellingPrice (seller-admin Price List export). */
export function getMergedNoteLines(
  rows: NoteRow[]
): { line: string; brandId: string | null }[] {
  const groups: Record<string, NoteRow[]> = {};
  rows.forEach((row) => {
    const key = `${row.productName}|||${row.sellingPrice}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  return Object.entries(groups).map(([, items]) => {
    const price = items[0].sellingPrice;
    const productName = items[0].productName;
    const brandId = items[0].brandId ?? null;
    if (items.length === 1) {
      const v = items[0].variantDisplay || items[0].sku || "-";
      return { line: `${productName} ${v} - ${formatMoneyTk(price)}`, brandId };
    }
    const parts = items.map((r) => {
      const v = (r.variantDisplay || r.sku || "").trim();
      if (!v) return "";
      const lastSpace = v.lastIndexOf(" ");
      if (lastSpace > 0)
        return { base: v.slice(0, lastSpace), value: v.slice(lastSpace + 1) };
      return { base: "", value: v };
    });
    const withParts = parts.filter(
      (p): p is { base: string; value: string } =>
        p !== "" && typeof p === "object"
    );
    const bases = [...new Set(withParts.map((p) => p.base))];
    const baseStr = bases.length === 1 && bases[0] ? bases[0] + " " : "";
    const values = withParts.map((p) => p.value).join(", ");
    const mergedVariant = baseStr ? `${baseStr}(${values})` : `(${values})`;
    return { line: `${productName} ${mergedVariant} - ${formatMoneyTk(price)}`, brandId };
  });
}

import type { LabelItem, LabelPreview, LabelSettings, PrintLabelKind } from "./types";

export function buildLabelPreview(
  kind: PrintLabelKind,
  items: LabelItem[],
  settings: LabelSettings,
  storeName?: string
): LabelPreview {
  const selectedItems = items.filter((item) => item.selected && item.quantity > 0);
  const expandedItems: LabelItem[] = [];
  selectedItems.forEach((item) => {
    for (let i = 0; i < item.quantity; i++) {
      expandedItems.push({ ...item, id: `${item.batchId}-${i}` });
    }
  });
  return {
    kind,
    items: expandedItems,
    settings,
    storeName,
  };
}

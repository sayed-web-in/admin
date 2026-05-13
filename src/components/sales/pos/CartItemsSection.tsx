"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, Pencil, Package, ChevronDown, ChevronUp } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PosItem {
  storeProductId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
  serialNumbers?: string[];
  batchNumber?: string;
  batchNumbers?: string[];
  serialBatchMap?: Record<string, string>;
}

interface CartItemsSectionProps {
  cart: PosItem[];
  onUpdateQty: (id: number, qty: number) => void;
  onEditPrice: (item: PosItem) => void;
}

export function CartItemsSection({ cart, onUpdateQty, onEditPrice }: CartItemsSectionProps) {
  if (cart.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium text-slate-900 mb-1">No items in cart</p>
        <p className="text-xs text-slate-500">Add products to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cart.map((item, index) => (
        <CartItemCard
          key={item.storeProductId}
          item={item}
          serialNo={index + 1}
          onUpdateQty={onUpdateQty}
          onEditPrice={onEditPrice}
        />
      ))}
    </div>
  );
}

function CartItemCard({
  item,
  serialNo,
  onUpdateQty,
  onEditPrice,
}: {
  item: PosItem;
  serialNo: number;
  onUpdateQty: (id: number, qty: number) => void;
  onEditPrice: (item: PosItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const batchGroups = useMemo(() => {
    const serials = item.serialNumbers ?? [];
    const batchMap = item.serialBatchMap ?? {};
    if (serials.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const serial of serials) {
        const batch = batchMap[serial] || item.batchNumber || "Unknown Batch";
        if (!grouped[batch]) grouped[batch] = [];
        grouped[batch].push(serial);
      }
      return Object.entries(grouped).map(([batchNumber, serialNumbers]) => ({
        batchNumber,
        quantity: serialNumbers.length,
        serialNumbers,
      }));
    }

    const list = item.batchNumbers && item.batchNumbers.length > 0
      ? item.batchNumbers
      : item.batchNumber
        ? [item.batchNumber]
        : [];
    if (list.length === 0) return [];
    const countMap: Record<string, number> = {};
    for (const b of list) countMap[b] = (countMap[b] || 0) + 1;
    return Object.entries(countMap).map(([batchNumber, quantity]) => ({
      batchNumber,
      quantity,
      serialNumbers: [] as string[],
    }));
  }, [item.batchNumber, item.batchNumbers, item.serialBatchMap, item.serialNumbers]);

  const hasImei = Boolean(item.serialNumbers && item.serialNumbers.length > 0);

  return (
    <div className="p-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="text-[10px] font-semibold text-primary">{serialNo}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 truncate">{item.name}</p>
          {item.variant && <p className="text-[10px] text-slate-500 truncate">{item.variant}</p>}
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {item.quantity} x {formatPrice(item.price)}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEditPrice(item)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                title="Edit unit price"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs font-bold text-primary mt-1">{formatPrice(item.price * item.quantity)}</p>
        </div>

        <button
          onClick={() => onUpdateQty(item.storeProductId, 0)}
          className="w-6 h-6 flex items-center justify-center text-red-500 shrink-0"
          title="Remove item"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-center">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full h-8 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          title={expanded ? "Hide batch details" : "Show batch details"}
        >
          <span className="text-[11px] font-medium">{expanded ? "Hide details" : "View details"}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
          {batchGroups.length === 0 ? (
            <div className="text-[11px] text-slate-500">Batch info not available.</div>
          ) : (
            batchGroups.map((group) => (
              <div key={group.batchNumber} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex flex-col">
                    <span className="font-semibold text-primary">Batch: {group.batchNumber}</span>
                    <span className="font-medium text-slate-700">Qty: {group.quantity}</span>
                  </div>
                  {group.serialNumbers.length === 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onUpdateQty(item.storeProductId, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs w-6 text-center text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.storeProductId, item.quantity + 1)}
                        disabled={hasImei}
                        className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {group.serialNumbers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {group.serialNumbers.map((serial) => (
                      <span
                        key={serial}
                        className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"
                      >
                        {serial}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

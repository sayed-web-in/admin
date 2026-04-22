"use client";

import { Minus, Plus, Trash2, Pencil, Package } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PosItem {
  storeProductId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
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
        <div
          key={item.storeProductId}
          className="p-3 rounded-lg border border-slate-200 bg-white"
        >
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold text-indigo-600">{index + 1}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{item.name}</p>
              {item.variant && <p className="text-[10px] text-slate-500 truncate">{item.variant}</p>}
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs font-bold text-primary">
                  {formatPrice(item.price * item.quantity)}
                </p>
                <button
                  type="button"
                  onClick={() => onEditPrice(item)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                  title="Edit unit price"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onUpdateQty(item.storeProductId, item.quantity - 1)}
                className="w-6 h-6 flex items-center justify-center bg-white rounded border border-slate-200"
              >
                <Minus size={12} />
              </button>
              <span className="text-xs w-6 text-center text-slate-900">{item.quantity}</span>
              <button
                onClick={() => onUpdateQty(item.storeProductId, item.quantity + 1)}
                className="w-6 h-6 flex items-center justify-center bg-white rounded border border-slate-200"
              >
                <Plus size={12} />
              </button>
              <button
                onClick={() => onUpdateQty(item.storeProductId, 0)}
                className="w-6 h-6 flex items-center justify-center text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

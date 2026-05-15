"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StoreProductRow } from "./types";

export interface EditStoreProductFormData {
  purchaseCostPerUnit: string;
  sellingPrice: string;
  discountType: "fixed" | "percentage" | "none";
  discountValue: string;
  sellingType: "online" | "store" | "both";
  quantityAlert: string;
}

interface EditStoreProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EditStoreProductFormData) => void;
  onDelete: () => void;
  storeProduct: StoreProductRow | null;
  canEditPurchaseCost?: boolean;
  showStockFields?: boolean;
  loading?: boolean;
}

function mapDiscountFromApi(t: string): "fixed" | "percentage" | "none" {
  if (t === "PERCENTAGE") return "percentage";
  if (t === "FIXED") return "fixed";
  return "none";
}

function mapSellingFromApi(t: string): "online" | "store" | "both" {
  if (t === "STORE") return "store";
  if (t === "ONLINE") return "online";
  return "both";
}

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

export function EditStoreProductModal({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  storeProduct,
  canEditPurchaseCost = false,
  showStockFields = false,
  loading = false,
}: EditStoreProductModalProps) {
  const [form, setForm] = useState<EditStoreProductFormData>({
    purchaseCostPerUnit: "",
    sellingPrice: "",
    discountType: "none",
    discountValue: "",
    sellingType: "both",
    quantityAlert: "",
  });

  useEffect(() => {
    if (open && storeProduct) {
      setForm({
        purchaseCostPerUnit: String(storeProduct.purchaseCostPerUnit ?? ""),
        sellingPrice: String(storeProduct.sellingPrice ?? ""),
        discountType: mapDiscountFromApi(storeProduct.discountType),
        discountValue: String(storeProduct.discountValue ?? ""),
        sellingType: mapSellingFromApi(storeProduct.sellingType),
        quantityAlert: String(storeProduct.quantityAlert ?? ""),
      });
    }
  }, [open, storeProduct]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Store product details"
      description="Update pricing, discount, and low-stock alert for this branch listing."
      icon={<Pencil className="h-5 w-5" aria-hidden />}
      size="md"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            className="w-full gap-2 sm:w-auto"
            disabled={loading}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            Delete
          </Button>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-store-product-form"
              className="w-full gap-2 rounded-xl sm:w-auto"
              disabled={loading}
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden />
              Update
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="edit-store-product-form"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Store
          </label>
          <Input
            value={storeProduct?.branch.name ?? "—"}
            disabled
            readOnly
            className="rounded-xl bg-muted/40"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Product variant
          </label>
          <Input
            value={
              storeProduct?.variantLabel ||
              storeProduct?.sku ||
              "—"
            }
            disabled
            readOnly
            className="rounded-xl bg-muted/40"
          />
        </div>

        {showStockFields ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Purchase cost per unit (average)
            </label>
            <p className="mb-1.5 text-xs text-muted-foreground">
              {canEditPurchaseCost
                ? "Initial stock only: you can edit this before any sale."
                : "Locked when multiple batches exist or any sale has happened."}
            </p>
            <Input
              type="text"
              inputMode="decimal"
              value={form.purchaseCostPerUnit}
              disabled={loading || !canEditPurchaseCost}
              readOnly={!canEditPurchaseCost}
              aria-readonly={!canEditPurchaseCost}
              onChange={(e) =>
                setForm((f) => ({ ...f, purchaseCostPerUnit: e.target.value }))
              }
              className={`rounded-xl ${canEditPurchaseCost ? "" : "cursor-not-allowed opacity-90"}`}
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Selling price <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            step="0.01"
            min={0}
            required
            value={form.sellingPrice}
            disabled={loading}
            onChange={(e) =>
              setForm((f) => ({ ...f, sellingPrice: e.target.value }))
            }
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Discount type
            </label>
            <select
              className={selectClass}
              value={form.discountType}
              disabled={loading}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  discountType: e.target.value as EditStoreProductFormData["discountType"],
                }))
              }
            >
              <option value="none">None</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </div>
          {form.discountType !== "none" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Discount value
              </label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.discountValue}
                disabled={loading}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountValue: e.target.value }))
                }
                className="rounded-xl"
              />
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Selling type
          </label>
          <select
            className={selectClass}
            value={form.sellingType}
            disabled={loading}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                sellingType: e.target.value as EditStoreProductFormData["sellingType"],
              }))
            }
          >
            <option value="online">Online</option>
            <option value="store">Store</option>
            <option value="both">Both</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Quantity alert (low stock threshold)
          </label>
          <Input
            type="number"
            min={0}
            value={form.quantityAlert}
            disabled={loading}
            onChange={(e) =>
              setForm((f) => ({ ...f, quantityAlert: e.target.value }))
            }
            className="rounded-xl"
          />
        </div>
      </form>
    </Modal>
  );
}

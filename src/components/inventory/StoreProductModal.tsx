"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VariantEntry } from "./VariantModal";

interface Branch {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface StoreProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number | null;
  productType: "SINGLE" | "VARIABLE";
  hasImei: boolean;
  variants: VariantEntry[];
}

export function StoreProductModal({
  open,
  onOpenChange,
  productId,
  productType,
  hasImei,
  variants,
}: StoreProductModalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [step, setStep] = useState<1 | 2>(1);

  const [branchId, setBranchId] = useState(0);
  const [variantId, setVariantId] = useState("");

  const [supplierId, setSupplierId] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [qtyAlert, setQtyAlert] = useState("");
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [sellingType, setSellingType] = useState("both");
  const [bestDeal, setBestDeal] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [imeiValues, setImeiValues] = useState<string[]>([""]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setBranchId(0);
      setVariantId("");
      resetForm();

      apiFetch<{ branches: Branch[] }>("/branches")
        .then((d) => setBranches(d.branches || []))
        .catch(() => setBranches([]));
      apiFetch<{ suppliers: Supplier[] }>("/contacts/suppliers")
        .then((d) => setSuppliers(d.suppliers || []))
        .catch(() => setSuppliers([]));
    }
  }, [open]);

  const resetForm = () => {
    setSupplierId(0);
    setQuantity("");
    setPurchasePrice("");
    setSellingPrice("");
    setQtyAlert("");
    setDiscountType("none");
    setDiscountValue("");
    setSellingType("both");
    setBestDeal(false);
    setFeatured(false);
    setImeiValues([""]);
  };

  const handleStepOne = () => {
    if (!branchId) return;
    if (productType === "VARIABLE" && !variantId) return;
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!quantity || !sellingPrice) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        productId,
        branchId,
        variantId: productType === "VARIABLE" ? variantId : undefined,
        supplierId: supplierId || undefined,
        quantity: Number(quantity),
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        sellingPrice: Number(sellingPrice),
        quantityAlert: qtyAlert ? Number(qtyAlert) : undefined,
        discountType: discountType !== "none" ? discountType : undefined,
        discountValue: discountType !== "none" ? Number(discountValue) : undefined,
        sellingType,
        bestDeal,
        featured,
      };
      if (hasImei) {
        payload.serialNumbers = imeiValues.filter((v) => v.trim());
      }
      await apiFetch("/products/add-to-store", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedVariant = variants.find((v) => v.id === variantId);
  const branchName = branches.find((b) => b.id === branchId)?.name || "";

  const ToggleSwitch = ({
    value,
    onChange,
    label,
  }: {
    value: boolean;
    onChange: (v: boolean) => void;
    label: string;
  }) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-orange-500" : "bg-gray-300"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
      <span className="text-sm">{label}</span>
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={step === 1 ? "Add to Store" : "Store Product Details"}
      className="max-w-xl"
    >
      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Branch <span className="text-red-500">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={0}>Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {productType === "VARIABLE" && variants.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Variant <span className="text-red-500">*</span>
              </label>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select Variant</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.attributes.map((a) => a.valueName).join(" / ")} — {v.sku}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleStepOne}>Next</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
            <p>
              <span className="font-medium">Branch:</span> {branchName}
            </p>
            {selectedVariant && (
              <p>
                <span className="font-medium">Variant:</span>{" "}
                {selectedVariant.attributes
                  .map((a) => `${a.attributeName}: ${a.valueName}`)
                  .join(", ")}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Supplier
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={0}>Select Supplier (optional)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Quantity <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Purchase Price
              </label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                min={0}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                min={0}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Quantity Alert
              </label>
              <Input
                type="number"
                value={qtyAlert}
                onChange={(e) => setQtyAlert(e.target.value)}
                min={0}
                placeholder="Low stock threshold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="none">None</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            {discountType !== "none" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Discount Value
                </label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  min={0}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Selling Type
            </label>
            <select
              value={sellingType}
              onChange={(e) => setSellingType(e.target.value)}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="online">Online</option>
              <option value="store">Store</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-4">
            <ToggleSwitch
              value={bestDeal}
              onChange={setBestDeal}
              label="Best Deal"
            />
            <ToggleSwitch
              value={featured}
              onChange={setFeatured}
              label="Featured Product"
            />
          </div>

          {hasImei && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Serial / IMEI Numbers
              </label>
              <div className="space-y-2">
                {imeiValues.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={val}
                      onChange={(e) =>
                        setImeiValues((prev) =>
                          prev.map((v, i) => (i === idx ? e.target.value : v))
                        )
                      }
                      placeholder={`Serial/IMEI ${idx + 1}`}
                    />
                    {imeiValues.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setImeiValues((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        <X size={14} className="text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImeiValues((prev) => [...prev, ""])}
                >
                  <Plus size={14} className="mr-1" /> Add Serial/IMEI
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !quantity || !sellingPrice}
            >
              {saving ? "Submitting..." : "Add to Store"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

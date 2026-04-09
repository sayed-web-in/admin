"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Printer, RotateCcw, Barcode } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";

interface Branch {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  type: string;
  variants?: { id: string; label: string }[];
}

interface BatchOption {
  id: number;
  batchNumber: string;
  barcode: string;
}

interface PrintItem {
  id: string;
  productName: string;
  variantLabel: string;
  batchNumber: string;
  barcode: string;
  quantity: number;
}

export default function BarcodePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);

  const [branchId, setBranchId] = useState(0);
  const [productId, setProductId] = useState(0);
  const [variantId, setVariantId] = useState("");
  const [batchId, setBatchId] = useState(0);

  const [printList, setPrintList] = useState<PrintItem[]>([]);
  const [paperSize, setPaperSize] = useState("A4");
  const [showStoreName, setShowStoreName] = useState(true);
  const [showBatch, setShowBatch] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showVariant, setShowVariant] = useState(true);
  const [showPrice, setShowPrice] = useState(true);

  useEffect(() => {
    apiFetch<{ branches: Branch[] }>("/branches")
      .then((d) => setBranches(d.branches || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!branchId) {
      setProducts([]);
      return;
    }
    apiFetch<{ products: Product[] }>(
      `/products/store?branchId=${branchId}`
    )
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]));
    setProductId(0);
    setVariantId("");
    setBatchId(0);
  }, [branchId]);

  useEffect(() => {
    if (!productId) {
      setBatches([]);
      return;
    }
    const params = new URLSearchParams({
      productId: String(productId),
      branchId: String(branchId),
    });
    if (variantId) params.set("variantId", variantId);
    apiFetch<{ batches: BatchOption[] }>(`/products/batches?${params}`)
      .then((d) => setBatches(d.batches || []))
      .catch(() => setBatches([]));
    setBatchId(0);
  }, [productId, variantId, branchId]);

  const selectedProduct = products.find((p) => p.id === productId);
  const hasVariants =
    selectedProduct?.type === "VARIABLE" &&
    (selectedProduct.variants?.length ?? 0) > 0;

  const addToPrintList = () => {
    if (!batchId) return;
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    const exists = printList.find(
      (item) => item.barcode === batch.barcode
    );
    if (exists) return;
    setPrintList((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productName: selectedProduct?.name || "",
        variantLabel: variantId
          ? selectedProduct?.variants?.find((v) => v.id === variantId)?.label ||
            ""
          : "",
        batchNumber: batch.batchNumber,
        barcode: batch.barcode,
        quantity: 1,
      },
    ]);
  };

  const updateQty = (id: string, qty: number) => {
    setPrintList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, qty) } : item
      )
    );
  };

  const removeItem = (id: string) => {
    setPrintList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGenerate = async () => {
    try {
      await apiFetch("/products/barcode/generate", {
        method: "POST",
        body: JSON.stringify({
          items: printList.map((i) => ({
            barcode: i.barcode,
            quantity: i.quantity,
          })),
          paperSize,
          options: {
            showStoreName,
            showBatch,
            showProductName,
            showVariant,
            showPrice,
          },
        }),
      });
      alert("Barcodes generated successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrint = () => window.print();
  const handleReset = () => setPrintList([]);

  const selectClasses =
    "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const printColumns = [
    {
      key: "productName",
      label: "Product",
    },
    {
      key: "variantLabel",
      label: "Variant",
      render: (item: PrintItem) => item.variantLabel || "—",
    },
    { key: "batchNumber", label: "Batch" },
    {
      key: "barcode",
      label: "Barcode",
      render: (item: PrintItem) => (
        <span className="font-mono text-xs">{item.barcode}</span>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      className: "w-24",
      render: (item: PrintItem) => (
        <Input
          type="number"
          value={item.quantity}
          onChange={(e) => updateQty(item.id, Number(e.target.value))}
          min={1}
          className="w-20 h-8 text-center"
        />
      ),
    },
    {
      key: "actions",
      label: "Action",
      className: "w-16",
      render: (item: PrintItem) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeItem(item.id)}
        >
          <Trash2 size={14} className="text-red-500" />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Print Barcode"
        description="Generate and print product barcodes"
      />

      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className={selectClasses}
            >
              <option value={0}>Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Product</label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(Number(e.target.value));
                setVariantId("");
              }}
              className={selectClasses}
              disabled={!branchId}
            >
              <option value={0}>Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {hasVariants && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Variant
              </label>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className={selectClasses}
              >
                <option value="">Select Variant</option>
                {selectedProduct?.variants?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Batch</label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(Number(e.target.value))}
              className={selectClasses}
              disabled={!productId}
            >
              <option value={0}>Select Batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchNumber} — {b.barcode}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={addToPrintList} disabled={!batchId}>
          <Plus size={16} className="mr-2" /> Add to Print List
        </Button>
      </div>

      {printList.length > 0 && (
        <>
          <DataTable columns={printColumns} data={printList} />

          <div className="bg-white rounded-xl border border-border p-5 mt-6">
            <h3 className="text-sm font-semibold mb-3">Print Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Paper Size
                </label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                  className={selectClasses}
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              {[
                { label: "Store Name", checked: showStoreName, set: setShowStoreName },
                { label: "Batch", checked: showBatch, set: setShowBatch },
                { label: "Product Name", checked: showProductName, set: setShowProductName },
                { label: "Variant", checked: showVariant, set: setShowVariant },
                { label: "Price", checked: showPrice, set: setShowPrice },
              ].map((opt) => (
                <label
                  key={opt.label}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={() => opt.set(!opt.checked)}
                    className="accent-orange-500"
                  />
                  Show {opt.label}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate}>
                <Barcode size={16} className="mr-2" /> Generate Barcode
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw size={16} className="mr-2" /> Reset
              </Button>
              <Button variant="secondary" onClick={handlePrint}>
                <Printer size={16} className="mr-2" /> Print Barcode
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

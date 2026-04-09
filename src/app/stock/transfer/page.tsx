"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowRightLeft,
  Search,
  Trash2,
  Eye,
  Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Branch {
  id: number;
  name: string;
}

interface StoreProduct {
  id: number;
  product?: { name: string };
  variant?: { label: string };
  quantity: number;
}

interface TransferItem {
  uid: string;
  storeProductId: number;
  productName: string;
  variantLabel: string;
  availableQty: number;
  transferQty: number;
}

interface Transfer {
  id: number;
  referenceNo?: string;
  fromBranch?: { id: number; name: string };
  toBranch?: { id: number; name: string };
  items?: { id: number; quantity: number; storeProduct?: { product?: { name: string } } }[];
  itemCount?: number;
  status: string;
  note?: string;
  createdAt: string;
}

export default function StockTransferPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fromBranch, setFromBranch] = useState("");
  const [toBranch, setToBranch] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<StoreProduct[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [viewModal, setViewModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  useEffect(() => {
    apiFetch<any>("/branches")
      .then((d) => setBranches(d.branches || d.data || (Array.isArray(d) ? d : [])))
      .catch(() => {});
  }, []);

  const fetchTransfers = useCallback(async () => {
    setTransfersLoading(true);
    try {
      const res = await apiFetch<any>("/stock/transfers?limit=50");
      setTransfers(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setTransfers([]);
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const searchProducts = async (query: string) => {
    setProductSearch(query);
    if (query.length < 2 || !fromBranch) {
      setProductResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ search: query, limit: "20", branchId: fromBranch });
      const res = await apiFetch<any>(`/products/store?${params}`);
      const list = res.data || (Array.isArray(res) ? res : []);
      setProductResults(list);
      setShowDropdown(true);
    } catch {
      setProductResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addProduct = (sp: StoreProduct) => {
    if (items.find((i) => i.storeProductId === sp.id)) {
      setProductSearch("");
      setShowDropdown(false);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        uid: `${sp.id}-${Date.now()}`,
        storeProductId: sp.id,
        productName: sp.product?.name || "Product",
        variantLabel: sp.variant?.label || "—",
        availableQty: sp.quantity,
        transferQty: 1,
      },
    ]);
    setProductSearch("");
    setProductResults([]);
    setShowDropdown(false);
  };

  const updateQty = (uid: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== uid) return i;
        return { ...i, transferQty: Math.min(Math.max(1, qty), i.availableQty) };
      })
    );
  };

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const handleSubmit = async () => {
    if (!fromBranch || !toBranch) { alert("Select both branches"); return; }
    if (fromBranch === toBranch) { alert("Source and destination must differ"); return; }
    if (items.length === 0) { alert("Add at least one product"); return; }
    setSaving(true);
    try {
      await apiFetch("/stock/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromBranchId: Number(fromBranch),
          toBranchId: Number(toBranch),
          note: note || undefined,
          items: items.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.transferQty,
          })),
        }),
      });
      setItems([]);
      setNote("");
      fetchTransfers();
      alert("Transfer created successfully");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openView = async (transfer: Transfer) => {
    try {
      const full = await apiFetch<Transfer>(`/stock/transfers/${transfer.id}`);
      setSelectedTransfer(full);
    } catch {
      setSelectedTransfer(transfer);
    }
    setViewModal(true);
  };

  const selectClasses = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const historyColumns = [
    { key: "index", label: "#", className: "w-12", render: (_: Transfer, i: number) => i + 1 },
    {
      key: "referenceNo",
      label: "Reference",
      render: (item: Transfer) => item.referenceNo || `#${item.id}`,
    },
    {
      key: "fromBranch",
      label: "From",
      render: (item: Transfer) => item.fromBranch?.name || "—",
    },
    {
      key: "toBranch",
      label: "To",
      render: (item: Transfer) => item.toBranch?.name || "—",
    },
    {
      key: "items",
      label: "Items",
      className: "text-center",
      render: (item: Transfer) => item.items?.length || item.itemCount || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (item: Transfer) => <StatusBadge status={item.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Transfer) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Transfer) => (
        <Button variant="ghost" size="sm" onClick={() => openView(item)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Stock Transfer" description="Transfer stock between branches" />

      <div className="max-w-4xl space-y-6 mb-10">
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Transfer Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                From Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={fromBranch}
                onChange={(e) => {
                  setFromBranch(e.target.value);
                  setItems([]);
                }}
                className={selectClasses}
              >
                <option value="">Select source branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                To Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={toBranch}
                onChange={(e) => setToBranch(e.target.value)}
                className={selectClasses}
              >
                <option value="">Select destination branch...</option>
                {branches.filter((b) => String(b.id) !== fromBranch).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Products</h3>
          {!fromBranch ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Select a source branch first
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search products from source branch..."
                  value={productSearch}
                  onChange={(e) => searchProducts(e.target.value)}
                  onFocus={() => productResults.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  className="pl-9"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Searching...
                  </div>
                )}
                {showDropdown && productResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {productResults.map((sp) => (
                      <button
                        key={sp.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm flex justify-between items-center"
                        onMouseDown={() => addProduct(sp)}
                      >
                        <div>
                          <p className="font-medium">{sp.product?.name}</p>
                          {sp.variant?.label && (
                            <p className="text-xs text-muted-foreground">{sp.variant.label}</p>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">Stock: {sp.quantity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Search and add products above
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Variant</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-28">Available</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-28">Transfer Qty</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item) => (
                        <tr key={item.uid}>
                          <td className="px-3 py-2 font-medium">{item.productName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.variantLabel}</td>
                          <td className="px-3 py-2 text-center">{item.availableQty}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={item.transferQty || ""}
                              onChange={(e) => updateQty(item.uid, Number(e.target.value))}
                              className="h-8 text-center text-sm"
                              min={1}
                              max={item.availableQty}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button variant="ghost" size="sm" onClick={() => removeItem(item.uid)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Note</h3>
          <textarea
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for this transfer..."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={saving} className="px-8">
            {saving ? "Submitting..." : "Submit Transfer"}
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-foreground mb-4">Transfer History</h2>
        <DataTable columns={historyColumns} data={transfers} loading={transfersLoading} />
      </div>

      <Modal open={viewModal} onOpenChange={setViewModal} title="Transfer Details" className="max-w-md">
        {selectedTransfer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Reference</p>
                <p className="font-medium">{selectedTransfer.referenceNo || `#${selectedTransfer.id}`}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={selectedTransfer.status} />
              </div>
              <div>
                <p className="text-muted-foreground">From Branch</p>
                <p className="font-medium">{selectedTransfer.fromBranch?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">To Branch</p>
                <p className="font-medium">{selectedTransfer.toBranch?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(selectedTransfer.createdAt)}</p>
              </div>
            </div>

            {selectedTransfer.note && (
              <div>
                <p className="text-muted-foreground text-sm">Note</p>
                <p className="text-sm mt-1">{selectedTransfer.note}</p>
              </div>
            )}

            {selectedTransfer.items && selectedTransfer.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Items</h4>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {selectedTransfer.items.map((item) => (
                    <div key={item.id} className="flex justify-between px-3 py-2 text-sm">
                      <span>{item.storeProduct?.product?.name || "Product"}</span>
                      <span className="font-medium">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

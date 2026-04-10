"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingBag,
  DollarSign,
  Clock,
  CalendarDays,
  Eye,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PurchaseItem {
  id: number;
  quantity: number;
  unitCost: number;
  storeProduct?: {
    product?: { name: string };
    variant?: { label: string };
  };
}

interface Purchase {
  id: number;
  referenceNo: string;
  supplier?: { id: number; name: string; phone?: string; email?: string };
  branch?: { id: number; name: string };
  items?: PurchaseItem[];
  itemCount?: number;
  totalAmount: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: string;
  note?: string;
  createdAt: string;
}

interface Branch {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewModal, setViewModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const branchId = getSelectedBranch();

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (branchId) params.set("branchId", String(branchId));
      if (branchFilter) params.set("branchId", branchFilter);
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (supplierFilter) params.set("supplierId", supplierFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiFetch<any>(`/purchases?${params}`);
      setPurchases(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, branchFilter, search, statusFilter, supplierFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    apiFetch<any>("/branches")
      .then((d) => setBranches(d.branches || d.data || (Array.isArray(d) ? d : [])))
      .catch(() => {});
    apiFetch<any>("/contacts/suppliers")
      .then((d) => setSuppliers(d.suppliers || d.data || (Array.isArray(d) ? d : [])))
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const totalAmount = purchases.reduce((s, p) => s + Number(p.grandTotal || 0), 0);
    const pending = purchases.filter((p) => p.status?.toLowerCase() === "pending").length;
    const today = new Date().toDateString();
    const todayPurchases = purchases.filter((p) => new Date(p.createdAt).toDateString() === today);
    return { total: purchases.length, totalAmount, pending, todayPurchases: todayPurchases.length };
  }, [purchases]);

  const openView = async (purchase: Purchase) => {
    try {
      const full = await apiFetch<Purchase>(`/purchases/${purchase.id}`);
      setSelectedPurchase(full);
    } catch {
      setSelectedPurchase(purchase);
    }
    setViewModal(true);
  };

  const selectClasses = "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: Purchase, i: number) => i + 1 },
    { key: "referenceNo", label: "Reference No" },
    {
      key: "supplier",
      label: "Supplier",
      render: (item: Purchase) => item.supplier?.name || "—",
    },
    {
      key: "branch",
      label: "Branch",
      render: (item: Purchase) => item.branch?.name || "—",
    },
    {
      key: "itemCount",
      label: "Items",
      className: "text-center",
      render: (item: Purchase) => item.items?.length || item.itemCount || "—",
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (item: Purchase) => (
        <span className="font-medium">{formatPrice(Number(item.grandTotal))}</span>
      ),
    },
    {
      key: "paidAmount",
      label: "Paid",
      render: (item: Purchase) => formatPrice(Number(item.paidAmount || 0)),
    },
    {
      key: "dueAmount",
      label: "Due",
      render: (item: Purchase) => {
        const due = Number(item.dueAmount || 0);
        return due > 0 ? (
          <span className="text-red-600">{formatPrice(due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (item: Purchase) => <StatusBadge status={item.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Purchase) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Purchase) => (
        <Button variant="ghost" size="sm" onClick={() => openView(item)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Purchases"
        description="Manage purchase orders"
        action={
          <Link href="/purchases/add">
            <Button>
              <Plus size={16} className="mr-2" /> Add Purchase
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Purchases" value={stats.total} icon={ShoppingBag} />
        <StatCard title="Total Amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
        <StatCard title="Pending" value={stats.pending} icon={Clock} />
        <StatCard title="Today's Purchases" value={stats.todayPurchases} icon={CalendarDays} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by reference or supplier..."
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All Status</option>
          <option value="RECEIVED">Received</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL">Partial</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40 h-10"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40 h-10"
        />
      </FilterBar>

      <DataTable columns={columns} data={purchases} loading={loading} />

      <Modal
        open={viewModal}
        onOpenChange={setViewModal}
        title="Purchase Details"
        className="max-w-2xl"
      >
        {selectedPurchase && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Reference</p>
                <p className="font-medium">{selectedPurchase.referenceNo}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Supplier</p>
                <p className="font-medium">{selectedPurchase.supplier?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Branch</p>
                <p className="font-medium">{selectedPurchase.branch?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(selectedPurchase.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment Method</p>
                <p className="font-medium capitalize">{selectedPurchase.paymentMethod?.replace("_", " ") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={selectedPurchase.status} />
              </div>
            </div>

            {selectedPurchase.supplier && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-semibold mb-1">Supplier Info</p>
                <p>Name: {selectedPurchase.supplier.name}</p>
                {selectedPurchase.supplier.phone && <p>Phone: {selectedPurchase.supplier.phone}</p>}
                {selectedPurchase.supplier.email && <p>Email: {selectedPurchase.supplier.email}</p>}
              </div>
            )}

            {selectedPurchase.items && selectedPurchase.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Items</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Product</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Unit Cost</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedPurchase.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">
                            <p>{item.storeProduct?.product?.name || "Product"}</p>
                            {item.storeProduct?.variant?.label && (
                              <p className="text-xs text-muted-foreground">{item.storeProduct.variant.label}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatPrice(item.unitCost)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatPrice(item.unitCost * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(Number(selectedPurchase.totalAmount))}</span>
              </div>
              {Number(selectedPurchase.discount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-{formatPrice(Number(selectedPurchase.discount))}</span>
                </div>
              )}
              {Number(selectedPurchase.tax) > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>+{formatPrice(Number(selectedPurchase.tax))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                <span>Grand Total</span>
                <span className="text-primary">{formatPrice(Number(selectedPurchase.grandTotal))}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <span className="text-green-600">{formatPrice(Number(selectedPurchase.paidAmount || 0))}</span>
              </div>
              {Number(selectedPurchase.dueAmount) > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Due</span>
                  <span>{formatPrice(Number(selectedPurchase.dueAmount))}</span>
                </div>
              )}
            </div>

            {selectedPurchase.note && (
              <div>
                <p className="text-muted-foreground text-sm">Note</p>
                <p className="text-sm mt-1">{selectedPurchase.note}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Search,
  Hash,
  Package,
  ShoppingCart,
  Undo2,
  Building2,
  Eye,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/common/Modal";

interface SerialSearchSupplier {
  id?: string;
  name?: string;
  companyName?: string | null;
  phone?: string | null;
}

interface SerialSearchPurchase {
  id?: string;
  billNo?: string | null;
  invoiceNo?: string | null;
  purchaseDate?: string | null;
  supplier?: SerialSearchSupplier;
}

interface SerialSearchVariantAttr {
  attribute: { name: string };
  attributeValue: { value: string };
}

interface SerialSearchVariant {
  id: string;
  sku: string;
  attributes?: SerialSearchVariantAttr[];
}

interface SerialSearchSaleRow {
  id: string;
  invoiceNo?: string | null;
  orderNo?: string;
  orderDate: string;
  grandTotal: number;
  orderStatus: string;
  paymentStatus?: string;
  customer?: { id: string; name: string; phone?: string | null } | null;
  customerName?: string | null;
  branch?: { id: string; name: string } | null;
  retailer?: { name: string; phone?: string | null } | null;
  retailerId?: string | null;
}

interface SerialReturnRow {
  id: string;
  returnNo: string;
  returnDate: string;
  invoiceNo?: string | null;
  branchName?: string | null;
  createdAt: string;
}

interface SerialSearchMatch {
  id: string;
  serialNumber: string;
  status: string;
  product?: { id: string; name: string; productType?: string };
  variant?: SerialSearchVariant;
  branch?: { id: string; name: string };
  batch?: {
    id: string;
    batchNumber: string;
    batchDate?: string;
  };
  purchase?: SerialSearchPurchase | null;
  sellingPrice?: number;
  saleHistory?: SerialSearchSaleRow[];
  returnHistory?: SerialReturnRow[];
}

interface SerialSearchResponse {
  serialNumber: string;
  matchCount: number;
  matches: SerialSearchMatch[];
}

interface BatchDetailSerial {
  id: number;
  serial: string;
  status: string;
  createdAt: string;
}

interface BatchDetailPayload {
  batch: {
    id: number;
    batchNumber: string;
    batchDate: string;
    initialQty: number;
    availableQty: number;
    soldQty: number;
    returnQty: number;
    purchaseCost: number;
    serialNumbers: BatchDetailSerial[];
    supplier?: { name: string; phone?: string; email?: string };
  };
}

function parseVariantLabel(variant: SerialSearchVariant | undefined): string {
  if (!variant?.attributes?.length) return "";
  return variant.attributes
    .map((a) => `${a.attribute?.name ?? ""}: ${a.attributeValue?.value ?? ""}`)
    .filter(Boolean)
    .join(", ");
}

function serialStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    in_stock:
      "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-300",
    sold: "bg-blue-500/15 text-blue-700 border border-blue-500/30 dark:text-blue-300",
    returned:
      "bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:text-amber-200",
    damaged: "bg-red-500/15 text-red-700 border border-red-500/30 dark:text-red-300",
    warranty:
      "bg-purple-500/15 text-purple-700 border border-purple-500/30 dark:text-purple-300",
    transferred:
      "bg-slate-500/15 text-slate-700 border border-slate-500/30 dark:text-slate-300",
  };
  return `inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-muted text-muted-foreground border border-border"}`;
}

function saleStatusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "COMPLETED")
    return "bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 text-xs font-medium rounded px-2 py-0.5 dark:text-emerald-300";
  if (s === "PAY_LATER")
    return "bg-amber-500/15 text-amber-800 border border-amber-500/25 text-xs font-medium rounded px-2 py-0.5 dark:text-amber-200";
  if (s === "RETURNED" || s === "PARTIAL_RETURN")
    return "bg-slate-500/15 text-slate-700 border border-slate-500/25 text-xs font-medium rounded px-2 py-0.5 dark:text-slate-300";
  return "bg-muted text-muted-foreground border border-border text-xs font-medium rounded px-2 py-0.5";
}

function getCustomerLabel(sale: SerialSearchSaleRow): string {
  if (sale.retailerId || sale.retailer?.name) {
    return `Retailer: ${sale.retailer?.name ?? "—"}`;
  }
  if (sale.customer?.name || sale.customerName) {
    return `Customer: ${sale.customer?.name ?? sale.customerName ?? "—"}`;
  }
  return "Walking";
}

const sectionCard =
  "rounded-xl border border-border bg-card p-4 shadow-sm md:p-6";

export default function SerialNumberPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SerialSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchDetail, setBatchDetail] = useState<BatchDetailPayload["batch"] | null>(
    null
  );

  const clear = () => {
    setQuery("");
    setResult(null);
    setError(null);
    setBatchDetail(null);
    setBatchModalOpen(false);
  };

  const searchBySerial = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) {
      setError("Please enter a serial number or IMEI.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<SerialSearchResponse>(
        `/sales/serial/${encodeURIComponent(q)}`
      );
      if (data.matches && Array.isArray(data.matches)) {
        setResult({
          serialNumber: data.serialNumber ?? q,
          matchCount: data.matchCount ?? data.matches.length,
          matches: data.matches,
        });
      } else {
        setError("Unexpected response from server.");
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void searchBySerial(query);
  };

  const openBatchModal = async (batchId: string) => {
    const id = Number(batchId);
    if (!Number.isFinite(id) || id <= 0) return;
    setBatchModalOpen(true);
    setBatchLoading(true);
    setBatchDetail(null);
    try {
      const res = await apiFetch<BatchDetailPayload>(`/products/batches/${id}`);
      setBatchDetail(res.batch ?? null);
    } catch {
      setBatchDetail(null);
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Hash className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Serial Number / IMEI Search
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by IMEI or serial number to view product details, purchase, and
              sale history (seller-admin style).
            </p>
          </div>
        </div>
      </div>

      <div
        className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent"
        aria-hidden
      />

      <form onSubmit={handleSubmit} className={`${sectionCard} mb-6`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Enter IMEI or serial number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search className="mr-2 size-4" />
                  Search
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={clear} disabled={loading}>
              Clear
            </Button>
          </div>
        </div>
      </form>

      {error ? (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-10 animate-spin opacity-60" />
          <p className="text-sm">Searching…</p>
        </div>
      ) : null}

      {!loading && !error && !result ? (
        <div className={`${sectionCard} py-16 text-center`}>
          <Hash className="mx-auto mb-4 size-16 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Enter IMEI or serial number</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Results show product, branch, batch, linked purchase (when matched), and POS
            sale history for this unit.
          </p>
        </div>
      ) : null}

      {!loading && result ? (
        <div className="space-y-6">
          {result.matchCount > 1 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              <p className="m-0 font-medium">
                {result.matchCount} inventory records found for this IMEI / serial — each
                product / branch is shown below.
              </p>
            </div>
          ) : null}

          {result.matches.map((match, matchIdx) => (
            <div
              key={match.id}
              className="space-y-6 rounded-2xl border border-border bg-muted/20 p-4 md:p-6 dark:bg-muted/10"
            >
              {result.matchCount > 1 ? (
                <h2 className="m-0 border-b border-border pb-2 text-base font-semibold text-foreground">
                  Record {matchIdx + 1} of {result.matchCount}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({match.product?.name ?? "—"} · {match.branch?.name ?? "—"})
                  </span>
                </h2>
              ) : null}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className={sectionCard}>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Package className="size-5" />
                    Product &amp; status
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Product</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {match.product?.name ?? "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SKU</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {match.variant?.sku ?? "—"}
                      </p>
                    </div>
                    {parseVariantLabel(match.variant) ? (
                      <div>
                        <span className="text-muted-foreground">Variant</span>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {parseVariantLabel(match.variant)}
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-muted-foreground">Selling price</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {typeof match.sellingPrice === "number"
                          ? formatPrice(match.sellingPrice)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current status</span>
                      <p className="mt-0.5">
                        <span className={serialStatusBadgeClass(match.status)}>
                          {match.status.replace(/_/g, " ")}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IMEI / serial</span>
                      <p className="mt-0.5 font-mono font-medium text-foreground">
                        {match.serialNumber}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={sectionCard}>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Building2 className="size-5" />
                    Branch &amp; batch
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Branch</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {match.branch?.name ?? "—"}
                      </p>
                    </div>
                    {match.batch ? (
                      <div>
                        <span className="text-muted-foreground">Batch</span>
                        <button
                          type="button"
                          onClick={() => void openBatchModal(match.batch!.id)}
                          className="mt-0.5 block text-left text-sm font-medium text-primary underline decoration-dotted underline-offset-2 hover:text-primary/90"
                        >
                          {match.batch.batchNumber}
                        </button>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {match.batch.batchDate
                            ? formatDateTime(match.batch.batchDate)
                            : "—"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {match.purchase?.id ? (
                <div className={sectionCard}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Package className="size-5" />
                      Purchase info
                    </h2>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/purchases/${match.purchase.id}`}>
                        <Eye className="size-4" />
                        View
                      </Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Reference / bill</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {match.purchase.billNo ?? "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Invoice (note)</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {match.purchase.invoiceNo ?? "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Purchase date</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {match.purchase.purchaseDate
                          ? formatDateTime(match.purchase.purchaseDate)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Supplier</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {match.purchase.supplier?.companyName ??
                          match.purchase.supplier?.name ??
                          "—"}
                      </p>
                      {match.purchase.supplier?.phone ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {match.purchase.supplier.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {match.saleHistory && match.saleHistory.length > 0 ? (
                <div className={sectionCard}>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <ShoppingCart className="size-5" />
                    Sale history
                  </h2>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-[700px] w-full text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Invoice</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Customer</th>
                          <th className="px-3 py-2 font-medium">Branch</th>
                          <th className="px-3 py-2 font-medium">Grand total</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 text-center font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {match.saleHistory.map((sale) => (
                          <tr
                            key={`${match.id}-${sale.id}`}
                            className="border-t border-border hover:bg-muted/30"
                          >
                            <td className="px-3 py-2 font-medium text-foreground">
                              {sale.invoiceNo ?? sale.orderNo ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatDateTime(sale.orderDate)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {getCustomerLabel(sale)}
                              {sale.retailer?.phone ? (
                                <span className="mt-0.5 block text-xs">
                                  {sale.retailer.phone}
                                </span>
                              ) : null}
                              {sale.customer?.phone && !sale.retailer ? (
                                <span className="mt-0.5 block text-xs">
                                  {sale.customer.phone}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {sale.branch?.name ?? "—"}
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground">
                              {formatPrice(sale.grandTotal)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={saleStatusBadgeClass(sale.orderStatus)}>
                                {sale.orderStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Button variant="link" size="sm" asChild className="gap-1">
                                <Link href={`/sales/history/${sale.id}`}>
                                  <Eye className="size-4" />
                                  View
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {match.returnHistory && match.returnHistory.length > 0 ? (
                <div className={sectionCard}>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Undo2 className="size-5" />
                    Return history
                  </h2>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-[600px] w-full text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="w-10 px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Return no</th>
                          <th className="px-3 py-2 font-medium">Return date</th>
                          <th className="px-3 py-2 font-medium">Invoice</th>
                          <th className="px-3 py-2 font-medium">Branch</th>
                          <th className="px-3 py-2 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {match.returnHistory.map((r, idx) => (
                          <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-foreground">
                              {r.returnNo}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatDateTime(r.returnDate)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {r.invoiceNo ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {r.branchName ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatDateTime(r.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {(!match.saleHistory || match.saleHistory.length === 0) &&
              match.status !== "returned" ? (
                <div className={`${sectionCard} py-8 text-center text-sm text-muted-foreground`}>
                  This unit has not been sold yet (for this product / branch).
                </div>
              ) : null}

              {(!match.returnHistory || match.returnHistory.length === 0) &&
              match.status !== "in_stock" &&
              match.status !== "sold" ? (
                <div className={`${sectionCard} py-8 text-center text-sm text-muted-foreground`}>
                  No return history for this serial (for this product). Per-IMEI return
                  rows are not stored on returns yet.
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Modal
        open={batchModalOpen}
        onOpenChange={(o) => {
          setBatchModalOpen(o);
          if (!o) setBatchDetail(null);
        }}
        title="Batch details"
        description="Serials attached to this batch"
        size="lg"
      >
        {batchLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Loading…
          </div>
        ) : batchDetail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Batch</span>
                <p className="font-mono font-medium">{batchDetail.batchNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date</span>
                <p>{formatDateTime(batchDetail.batchDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Available</span>
                <p>{batchDetail.availableQty}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Unit cost</span>
                <p>{formatPrice(batchDetail.purchaseCost)}</p>
              </div>
            </div>
            {batchDetail.supplier?.name ? (
              <p className="text-muted-foreground">
                Supplier: <span className="text-foreground">{batchDetail.supplier.name}</span>
                {batchDetail.supplier.phone
                  ? ` · ${batchDetail.supplier.phone}`
                  : ""}
              </p>
            ) : null}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-3 py-2">Serial / IMEI</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchDetail.serialNumbers?.length ? (
                    batchDetail.serialNumbers.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{s.serial}</td>
                        <td className="px-3 py-1.5 capitalize text-muted-foreground">
                          {String(s.status).toLowerCase().replace(/_/g, " ")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                        No serial rows on this batch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Could not load batch.
          </p>
        )}
      </Modal>
    </div>
  );
}

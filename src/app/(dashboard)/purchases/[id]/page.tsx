"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  Eye,
  FileText,
  History,
  Loader2,
  Package,
  RefreshCcw,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate, formatDateTimeMedShort } from "@/lib/utils";
import { ViewSerialNumbersModal } from "@/app/(dashboard)/inventory/add-product/ViewSerialNumbersModal";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";

type PurchaseItemRow = {
  id: number;
  storeProductId: number;
  quantity: number;
  unitCost: number | string;
  total?: number | string;
  /** Populated by GET /purchases/:id (purchase batches in the same window as the invoice). */
  serialNumbers?: { serial: string; status?: string }[];
  storeProduct?: {
    product?: { name?: string };
    productVariant?: {
      sku?: string;
      attributes?: { attributeValue?: { value?: string } | null }[] | null;
    } | null;
  };
};

type ReturnLine = {
  id: number;
  storeProductId: number;
  quantity: number;
  unitCost: number | string;
  total?: number | string;
};

type PurchaseReturnBlock = {
  id: number;
  reason?: string | null;
  totalAmount: number | string;
  createdAt: string;
  items?: ReturnLine[];
};

type PurchaseDetail = {
  id: number;
  referenceNo: string;
  supplier?: {
    id?: number;
    name?: string;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  branch?: { id?: number; name?: string } | null;
  items?: PurchaseItemRow[];
  returns?: PurchaseReturnBlock[];
  totalAmount: number | string;
  discount: number | string;
  tax: number | string;
  shippingCost?: number | string;
  grandTotal: number | string;
  paidAmount: number | string;
  dueAmount: number | string;
  paymentMethod?: string;
  paymentAccount?: {
    id?: number;
    name?: string;
    accountNumber?: string | null;
  } | null;
  status: string;
  note?: string | null;
  createdAt: string;
  paymentHistory?: PaymentHistoryRow[];
};

type PaymentHistoryRow = {
  id: string;
  source?: string;
  paymentDate: string;
  amount: number;
  paymentMethod?: string | null;
  transactionId?: string | null;
  note?: string | null;
  account?: {
    accountName?: string;
    accountNumber?: string | null;
  } | null;
};

function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function variantLabel(item: PurchaseItemRow): string | undefined {
  const attrs = item.storeProduct?.productVariant?.attributes;
  if (!attrs?.length) return undefined;
  const parts = attrs
    .map((a) => a.attributeValue?.value)
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" / ") : undefined;
}

function sumReturnedQty(returns: PurchaseReturnBlock[] | undefined, storeProductId: number): number {
  if (!returns?.length) return 0;
  let sum = 0;
  for (const r of returns) {
    for (const line of r.items ?? []) {
      if (Number(line.storeProductId) === storeProductId) {
        sum += Number(line.quantity) || 0;
      }
    }
  }
  return sum;
}

function productNameForReturnLine(
  purchaseItems: PurchaseItemRow[] | undefined,
  storeProductId: number
): string {
  const hit = purchaseItems?.find((pi) => Number(pi.storeProductId) === storeProductId);
  return hit?.storeProduct?.product?.name || `Store product #${storeProductId}`;
}

export default function PurchaseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const purchaseId = useMemo(() => {
    const n = parseInt(String(rawId ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [rawId]);

  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [serialModalRows, setSerialModalRows] = useState<{ serial: string; status?: string }[]>([]);

  const load = useCallback(async () => {
    if (!purchaseId) {
      setError("Invalid purchase id");
      setPurchase(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PurchaseDetail>(`/purchases/${purchaseId}`);
      setPurchase(data);
    } catch (e) {
      setPurchase(null);
      setError(e instanceof Error ? e.message : "Failed to load purchase");
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => purchase?.items ?? [], [purchase]);
  const lineSubtotal = useMemo(
    () =>
      items.reduce((s, it) => {
        const line = num(it.total) > 0 ? num(it.total) : num(it.unitCost) * num(it.quantity);
        return s + line;
      }, 0),
    [items]
  );

  const totalQty = useMemo(() => items.reduce((s, it) => s + num(it.quantity), 0), [items]);

  const returnHref = purchase?.id
    ? `/purchases/return/create?purchaseId=${purchase.id}`
    : purchase?.referenceNo
      ? `/purchases/return/create?ref=${encodeURIComponent(purchase.referenceNo)}`
      : "/purchases/return/create";

  if (!purchaseId) {
    return (
      <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
        <InventoryListPageHeader
          icon={FileText}
          title="Purchase details"
          description="Invalid link."
        >
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
            <Link href="/purchases">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
            </Link>
          </Button>
        </InventoryListPageHeader>
        <section className={`${INVENTORY_CARD_SHELL} p-6 text-sm text-muted-foreground`}>
          This purchase id is not valid.
        </section>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={FileText}
        title="Purchase details"
        description={
          loading
            ? "Loading…"
            : purchase
              ? `${purchase.referenceNo} · ${purchase.branch?.name ?? "Branch"}`
              : "Purchase"
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 rounded-xl sm:h-9"
          onClick={() => router.push("/purchases")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {purchase && purchase.status !== "RETURNED" && (
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
            <Link href={returnHref}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Create return
            </Link>
          </Button>
        )}
      </InventoryListPageHeader>

      {loading ? (
        <section className={`${INVENTORY_CARD_SHELL} flex items-center justify-center gap-2 p-12 text-muted-foreground`}>
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading purchase…
        </section>
      ) : error || !purchase ? (
        <section className={`${INVENTORY_CARD_SHELL} p-8 text-center`}>
          <p className="font-medium text-destructive">{error || "Purchase not found"}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been removed or you may not have access.
          </p>
          <Button type="button" className="mt-6" variant="outline" asChild>
            <Link href="/purchases">Back to purchases</Link>
          </Button>
        </section>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={User} title="Supplier" />
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{purchase.supplier?.name ?? "—"}</p>
                </div>
                {purchase.supplier?.company ? (
                  <div>
                    <p className="text-muted-foreground">Company</p>
                    <p className="font-medium">{purchase.supplier.company}</p>
                  </div>
                ) : null}
                {purchase.supplier?.phone ? (
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{purchase.supplier.phone}</p>
                  </div>
                ) : null}
                {purchase.supplier?.email ? (
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{purchase.supplier.email}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={FileText} title="Purchase info" />
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="text-right font-medium">{purchase.referenceNo}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-right font-medium">{formatDate(purchase.createdAt)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Branch</span>
                  <span className="text-right font-medium">{purchase.branch?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={purchase.status} />
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Payment method</span>
                  <span className="text-right font-medium capitalize">
                    {(purchase.paymentMethod ?? "—").replace(/_/g, " ")}
                  </span>
                </div>
                {purchase.paymentAccount ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Account</span>
                    <span className="text-right font-medium">
                      {purchase.paymentAccount.name}
                      {purchase.paymentAccount.accountNumber
                        ? ` · ${purchase.paymentAccount.accountNumber}`
                        : ""}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Total units</span>
                  <span className="text-right font-medium">{totalQty}</span>
                </div>
                {purchase.note ? (
                  <div>
                    <p className="text-muted-foreground">Note</p>
                    <p className="mt-0.5 font-medium leading-relaxed">{purchase.note}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={DollarSign} title="Payment summary" />
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Grand total</span>
                  <span className="font-semibold">{formatPrice(num(purchase.grandTotal))}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatPrice(num(purchase.paidAmount))}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Due</span>
                  <span
                    className={
                      num(purchase.dueAmount) > 0
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "font-medium text-muted-foreground"
                    }
                  >
                    {formatPrice(num(purchase.dueAmount))}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
              <InventorySectionHeader compact icon={Package} title="Line items" description="Quantities, costs, and returns rolled up from this purchase." />
            </div>
            <div className="overflow-x-auto p-5 sm:p-6">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items on this purchase.</p>
              ) : (
                <>
                  <DataTable
                    inventoryStyle
                    columns={[
                      {
                        key: "i",
                        label: "#",
                        className: "w-10",
                        render: (_: PurchaseItemRow, i: number) => i + 1,
                      },
                      {
                        key: "product",
                        label: "Product",
                        render: (row: PurchaseItemRow) => (
                          <div>
                            <p className="font-medium">{row.storeProduct?.product?.name ?? "—"}</p>
                            {variantLabel(row) ? (
                              <p className="text-xs text-muted-foreground">{variantLabel(row)}</p>
                            ) : null}
                          </div>
                        ),
                      },
                      {
                        key: "sku",
                        label: "SKU",
                        render: (row: PurchaseItemRow) => (
                          <span className="text-muted-foreground">
                            {row.storeProduct?.productVariant?.sku ?? "—"}
                          </span>
                        ),
                      },
                      {
                        key: "qty",
                        label: "Qty",
                        className: "text-center",
                        render: (row: PurchaseItemRow) => num(row.quantity),
                      },
                      {
                        key: "ret",
                        label: "Returned",
                        className: "text-center",
                        render: (row: PurchaseItemRow) => {
                          const rq = sumReturnedQty(purchase.returns, row.storeProductId);
                          return rq > 0 ? (
                            <span className="font-medium text-amber-600 dark:text-amber-400">{rq}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          );
                        },
                      },
                      {
                        key: "imei",
                        label: "IMEI / Serial",
                        className: "text-center",
                        render: (row: PurchaseItemRow) => {
                          const sns = row.serialNumbers ?? [];
                          if (sns.length === 0) {
                            return <span className="text-muted-foreground">—</span>;
                          }
                          return (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1 rounded-lg px-3"
                              onClick={() => {
                                setSerialModalRows(sns);
                                setSerialModalOpen(true);
                              }}
                            >
                              <Eye className="size-3.5 shrink-0" />
                              View
                            </Button>
                          );
                        },
                      },
                      {
                        key: "unit",
                        label: "Unit cost",
                        className: "text-right",
                        render: (row: PurchaseItemRow) => formatPrice(num(row.unitCost)),
                      },
                      {
                        key: "line",
                        label: "Line total",
                        className: "text-right",
                        render: (row: PurchaseItemRow) =>
                          formatPrice(
                            num(row.total) > 0 ? num(row.total) : num(row.unitCost) * num(row.quantity)
                          ),
                      },
                    ]}
                    data={items}
                    loading={false}
                  />
                  <div className="mt-4 space-y-1 border-t border-border/60 pt-4 text-sm">
                    <div className="flex justify-end gap-8">
                      <span className="text-muted-foreground">Subtotal (lines)</span>
                      <span className="font-medium">{formatPrice(lineSubtotal)}</span>
                    </div>
                    {num(purchase.discount) > 0 ? (
                      <div className="flex justify-end gap-8 text-red-600 dark:text-red-400">
                        <span>Discount</span>
                        <span>−{formatPrice(num(purchase.discount))}</span>
                      </div>
                    ) : null}
                    {num(purchase.tax) > 0 ? (
                      <div className="flex justify-end gap-8">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-medium">{formatPrice(num(purchase.tax))}</span>
                      </div>
                    ) : null}
                    {num(purchase.shippingCost) > 0 ? (
                      <div className="flex justify-end gap-8">
                        <span className="text-muted-foreground">Shipping</span>
                        <span className="font-medium">{formatPrice(num(purchase.shippingCost))}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-end gap-8 pt-2 text-base font-semibold">
                      <span>Grand total</span>
                      <span className="text-primary">{formatPrice(num(purchase.grandTotal))}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {purchase.returns && purchase.returns.length > 0 ? (
            <section className={INVENTORY_CARD_SHELL}>
              <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
                <InventorySectionHeader
                  compact
                  icon={RefreshCcw}
                  title="Purchase returns"
                  description="Returns logged against this purchase."
                />
              </div>
              <div className="space-y-6 p-5 sm:p-6">
                {purchase.returns.map((ret) => (
                  <div key={ret.id} className="rounded-xl border border-border/60 bg-muted/5 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Date </span>
                        <span className="font-medium">{formatDate(ret.createdAt)}</span>
                      </div>
                      <div className="font-semibold">{formatPrice(num(ret.totalAmount))}</div>
                    </div>
                    {ret.reason ? (
                      <p className="mb-3 text-sm text-muted-foreground">{ret.reason}</p>
                    ) : null}
                    <DataTable
                      inventoryStyle
                      columns={[
                        {
                          key: "p",
                          label: "Product",
                          render: (row: ReturnLine) => (
                            <span className="font-medium">
                              {productNameForReturnLine(purchase.items, row.storeProductId)}
                            </span>
                          ),
                        },
                        {
                          key: "q",
                          label: "Qty",
                          className: "text-center",
                          render: (row: ReturnLine) => num(row.quantity),
                        },
                        {
                          key: "u",
                          label: "Unit cost",
                          className: "text-right",
                          render: (row: ReturnLine) => formatPrice(num(row.unitCost)),
                        },
                        {
                          key: "t",
                          label: "Total",
                          className: "text-right",
                          render: (row: ReturnLine) =>
                            formatPrice(num(row.total) > 0 ? num(row.total) : num(row.unitCost) * num(row.quantity)),
                        },
                      ]}
                      data={ret.items ?? []}
                      loading={false}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
              <InventorySectionHeader
                compact
                icon={History}
                title="Payment history"
                description="Account ledger lines for this reference and supplier payments allocated to this purchase."
              />
            </div>
            <div className="p-5 sm:p-6">
              {purchase.paymentHistory && purchase.paymentHistory.length > 0 ? (
                <DataTable
                  inventoryStyle
                  columns={[
                    {
                      key: "d",
                      label: "Date",
                      render: (row: PaymentHistoryRow) => (
                        <span className="text-muted-foreground">
                          {formatDateTimeMedShort(row.paymentDate)}
                        </span>
                      ),
                    },
                    {
                      key: "amt",
                      label: "Amount",
                      render: (row: PaymentHistoryRow) => (
                        <span className="font-medium">{formatPrice(row.amount)}</span>
                      ),
                    },
                    {
                      key: "acc",
                      label: "Account",
                      render: (row: PaymentHistoryRow) => (
                        <div>
                          <span className="font-medium">{row.account?.accountName ?? "—"}</span>
                          {row.account?.accountNumber ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              A/C: {row.account.accountNumber}
                            </span>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      key: "ref",
                      label: "Reference",
                      render: (row: PaymentHistoryRow) => (
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.transactionId ?? "—"}
                        </span>
                      ),
                    },
                    {
                      key: "type",
                      label: "Type",
                      render: (row: PaymentHistoryRow) => (
                        <span className="text-xs capitalize text-muted-foreground">
                          {row.paymentMethod
                            ? String(row.paymentMethod).toLowerCase().replace(/_/g, " ")
                            : row.source === "account"
                              ? "Ledger"
                              : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "note",
                      label: "Notes",
                      render: (row: PaymentHistoryRow) => (
                        <span className="text-muted-foreground">{row.note?.trim() || "—"}</span>
                      ),
                    },
                  ]}
                  data={purchase.paymentHistory}
                  loading={false}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No payment history found for this purchase.</p>
              )}
            </div>
          </section>
        </div>
      )}

      <ViewSerialNumbersModal
        open={serialModalOpen}
        onOpenChange={setSerialModalOpen}
        serials={serialModalRows}
        loading={false}
      />
    </div>
  );
}

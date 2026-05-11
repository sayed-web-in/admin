"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  FileText,
  Info,
  Loader2,
  Package,
  RefreshCcw,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate, formatDateTimeMedShort } from "@/lib/utils";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";

type StoreProductLite = {
  product?: { name?: string };
  productVariant?: {
    sku?: string;
    attributes?: { attributeValue?: { value?: string } | null }[] | null;
  } | null;
};

type ReturnItemDetail = {
  id: number;
  storeProductId: number;
  quantity: number;
  unitCost: number | string;
  total: number | string;
  storeProduct?: StoreProductLite | null;
};

type LedgerCredit = {
  id: number;
  amount: number | string;
  description?: string | null;
  createdAt: string;
  account?: { id: number; name?: string; accountNumber?: string | null } | null;
};

type PurchaseReturnDetail = {
  id: number;
  reason?: string | null;
  totalAmount: number | string;
  createdAt: string;
  purchase: {
    id: number;
    referenceNo: string;
    supplier?: { name?: string; company?: string | null; phone?: string | null } | null;
    branch?: { name?: string } | null;
    paymentAccount?: { name?: string; accountNumber?: string | null } | null;
  };
  items: ReturnItemDetail[];
  accounting: {
    returnAmount: number;
    purchaseReference: string;
    supplierDueReduced: boolean;
    supplierName: string | null;
    stockReduced: boolean;
    batchAdjusted: boolean;
    accountCredited: boolean;
    paymentAccountName: string | null;
    paymentAccountId: number | null;
    steps: string[];
  };
  ledgerCredits: LedgerCredit[];
};

function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function variantLabel(sp?: StoreProductLite | null): string | undefined {
  const attrs = sp?.productVariant?.attributes;
  if (!attrs?.length) return undefined;
  const parts = attrs
    .map((a) => a.attributeValue?.value)
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" / ") : undefined;
}

export default function PurchaseReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const returnId = useMemo(() => {
    const n = parseInt(String(params?.id ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.id]);

  const [data, setData] = useState<PurchaseReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!returnId) {
      setError("Invalid return id");
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PurchaseReturnDetail>(`/purchases/returns/${returnId}`);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load return");
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!returnId) {
    return (
      <div className="w-full min-w-0 space-y-5 pb-8 pt-1">
        <InventoryListPageHeader icon={RefreshCcw} title="Return details" description="Invalid id." />
        <Button variant="outline" asChild>
          <Link href="/purchases/return">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={RefreshCcw}
        title="Purchase return details"
        description={
          loading
            ? "Loading…"
            : data
              ? `${data.purchase.referenceNo} · ${formatDate(data.createdAt)}`
              : "Return"
        }
      >
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
          <Link href="/purchases/return">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        {data?.purchase?.id ? (
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
            <Link href={`/purchases/${data.purchase.id}`}>
              <ArrowLeftRight className="mr-2 h-4 w-4" /> View purchase
            </Link>
          </Button>
        ) : null}
      </InventoryListPageHeader>

      {loading ? (
        <section className={`${INVENTORY_CARD_SHELL} flex items-center justify-center gap-2 p-12 text-muted-foreground`}>
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </section>
      ) : error || !data ? (
        <section className={`${INVENTORY_CARD_SHELL} p-8 text-center`}>
          <p className="font-medium text-destructive">{error || "Not found"}</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/purchases/return">Back to list</Link>
          </Button>
        </section>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={User} title="Supplier" />
              <div className="mt-3 text-sm">
                <p className="font-medium">{data.purchase.supplier?.name ?? "—"}</p>
                {data.purchase.supplier?.company ? (
                  <p className="text-muted-foreground">{data.purchase.supplier.company}</p>
                ) : null}
                {data.purchase.supplier?.phone ? (
                  <p className="text-muted-foreground">{data.purchase.supplier.phone}</p>
                ) : null}
              </div>
            </section>
            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={Building2} title="Purchase & branch" />
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium">{data.purchase.referenceNo}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Branch</span>
                  <span className="font-medium">{data.purchase.branch?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Return total</span>
                  <span className="font-semibold text-primary">{formatPrice(num(data.totalAmount))}</span>
                </div>
              </div>
            </section>
            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={FileText} title="Return" />
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formatDate(data.createdAt)}</span>
                </div>
                <div>
                  <p className="text-muted-foreground">Reason</p>
                  <p className="mt-0.5 font-medium leading-relaxed">{data.reason?.trim() || "—"}</p>
                </div>
              </div>
            </section>
          </div>

          <section className={`${INVENTORY_CARD_SHELL} border-primary/20 bg-primary/[0.04] p-5 sm:p-6`}>
            <InventorySectionHeader
              compact
              icon={Info}
              title="Accounting (what the server did)"
              description="This matches the Nest purchase return transaction: stock, batch, supplier due, and optional account credit."
            />
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
              {data.accounting.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Implementation: <code className="rounded bg-muted px-1 py-0.5">backend/src/purchase/purchase.service.ts</code>{" "}
              → <code className="rounded bg-muted px-1 py-0.5">createReturn</code>. Add payment / adjustment buttons for
              other flows on the supplier or finance pages — this API does not expose seller-style return status or
              refund modals yet.
            </p>
          </section>

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
              <InventorySectionHeader compact icon={Package} title="Returned lines" />
            </div>
            <div className="p-5 sm:p-6">
              <DataTable
                inventoryStyle
                columns={[
                  { key: "n", label: "#", className: "w-10", render: (_: ReturnItemDetail, i: number) => i + 1 },
                  {
                    key: "p",
                    label: "Product",
                    render: (row: ReturnItemDetail) => (
                      <div>
                        <p className="font-medium">{row.storeProduct?.product?.name ?? "—"}</p>
                        {variantLabel(row.storeProduct) ? (
                          <p className="text-xs text-muted-foreground">{variantLabel(row.storeProduct)}</p>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    key: "sku",
                    label: "SKU",
                    render: (row: ReturnItemDetail) => (
                      <span className="text-muted-foreground">{row.storeProduct?.productVariant?.sku ?? "—"}</span>
                    ),
                  },
                  {
                    key: "q",
                    label: "Qty",
                    className: "text-center",
                    render: (row: ReturnItemDetail) => num(row.quantity),
                  },
                  {
                    key: "u",
                    label: "Unit cost",
                    className: "text-right",
                    render: (row: ReturnItemDetail) => formatPrice(num(row.unitCost)),
                  },
                  {
                    key: "t",
                    label: "Line total",
                    className: "text-right",
                    render: (row: ReturnItemDetail) => formatPrice(num(row.total)),
                  },
                ]}
                data={data.items}
                loading={false}
              />
            </div>
          </section>

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
              <InventorySectionHeader
                compact
                icon={FileText}
                title="Ledger credits (same purchase reference)"
                description="CREDIT rows posted when this return was recorded (if a payment account existed on the purchase)."
              />
            </div>
            <div className="p-5 sm:p-6">
              {data.ledgerCredits.length > 0 ? (
                <DataTable
                  inventoryStyle
                  columns={[
                    {
                      key: "d",
                      label: "Date",
                      render: (row: LedgerCredit) => (
                        <span className="text-muted-foreground">{formatDateTimeMedShort(row.createdAt)}</span>
                      ),
                    },
                    {
                      key: "a",
                      label: "Amount",
                      render: (row: LedgerCredit) => <span className="font-medium">{formatPrice(num(row.amount))}</span>,
                    },
                    {
                      key: "acc",
                      label: "Account",
                      render: (row: LedgerCredit) => (
                        <span>
                          {row.account?.name ?? "—"}
                          {row.account?.accountNumber ? ` · ${row.account.accountNumber}` : ""}
                        </span>
                      ),
                    },
                    {
                      key: "desc",
                      label: "Description",
                      render: (row: LedgerCredit) => (
                        <span className="text-xs text-muted-foreground">{row.description ?? "—"}</span>
                      ),
                    },
                  ]}
                  data={data.ledgerCredits}
                  loading={false}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No matching ledger credit found (older returns used a shorter description, or this purchase had no
                  payment account).
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

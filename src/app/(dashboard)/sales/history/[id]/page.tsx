"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  FileText,
  Package,
  RotateCcw,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/utils";
import { InvoicePreviewModal } from "@/components/sales/pos/InvoicePreviewModal";
import { Modal } from "@/components/common/Modal";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SaleSerial = { serial?: string; serialNumber?: string };

interface SaleItem {
  id: number;
  quantity: number;
  unitPrice: number;
  total: number;
  serialNumbers?: SaleSerial[] | string[];
  storeProduct?: {
    product?: { name?: string };
    productVariant?: {
      sku?: string;
      attributes?: Array<{ attributeValue?: { value?: string } }>;
    };
  };
}

interface SaleReturnItem {
  id: number;
  quantity: number;
  unitPrice: number;
  total: number;
  storeProductId: number;
}

interface SaleReturn {
  id: number;
  reason?: string | null;
  totalAmount: number;
  createdAt: string;
  items?: SaleReturnItem[];
}

interface SaleDetails {
  id: number;
  invoiceNumber: string;
  order?: { id: number; orderNumber: string } | null;
  createdAt: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  changeAmount: number;
  customer?: { id?: number; name?: string; phone?: string; email?: string };
  branch?: { name?: string };
  items?: SaleItem[];
  returns?: SaleReturn[];
}

interface PaymentHistoryRow {
  id: number;
  type: string;
  amount: number;
  reference?: string | null;
  description?: string | null;
  createdAt: string;
  account?: { id: number; name?: string; accountName?: string; accountType?: string; type?: string };
}

interface AccountOption {
  id: string | number;
  name?: string;
  accountName?: string;
  accountType?: string;
  type?: string;
  isActive?: boolean;
}

function serialsFromItem(item: SaleItem): string[] {
  const list = Array.isArray(item.serialNumbers) ? item.serialNumbers : [];
  return list
    .map((s) => (typeof s === "string" ? s : s?.serial || s?.serialNumber || ""))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

export default function SaleHistoryDetailsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<SaleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePayload, setInvoicePayload] = useState<unknown>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const loadSale = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>(`/sales/${id}`);
      const data =
        res && typeof res === "object" && "data" in (res as object)
          ? (res as { data: SaleDetails }).data
          : (res as SaleDetails);
      setSale(data ?? null);
    } catch {
      setSale(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSale();
  }, [loadSale]);

  const loadPaymentHistory = useCallback(async () => {
    try {
      const res = await apiFetch<unknown>(`/sales/${id}/payments`);
      const data =
        res && typeof res === "object" && "data" in (res as object)
          ? ((res as { data?: PaymentHistoryRow[] }).data ?? [])
          : ((res as PaymentHistoryRow[]) ?? []);
      setPaymentHistory(Array.isArray(data) ? data : []);
    } catch {
      setPaymentHistory([]);
    }
  }, [id]);

  useEffect(() => {
    void loadPaymentHistory();
  }, [loadPaymentHistory]);

  const itemRows = useMemo(() => {
    return (sale?.items ?? []).map((item) => {
      const variantValues =
        item.storeProduct?.productVariant?.attributes
          ?.map((a) => a.attributeValue?.value)
          .filter((v): v is string => Boolean(v && v.trim()))
          .join(", ") || "";
      return {
        id: item.id,
        name: item.storeProduct?.product?.name || "Product",
        sku: item.storeProduct?.productVariant?.sku || "—",
        variant: variantValues,
        qty: Number(item.quantity || 0),
        price: Number(item.unitPrice || 0),
        total: Number(item.total || item.unitPrice * item.quantity || 0),
        serials: serialsFromItem(item),
      };
    });
  }, [sale]);

  const returnRows = useMemo(
    () =>
      (sale?.returns ?? []).map((ret, idx) => ({
        id: ret.id,
        sl: idx + 1,
        date: ret.createdAt,
        reason: ret.reason || "—",
        items: ret.items?.length ?? 0,
        amount: Number(ret.totalAmount || 0),
      })),
    [sale]
  );

  const openInvoicePreview = () => {
    if (!sale) return;
    const payload = {
      invoiceNo: sale.invoiceNumber,
      orderNo: sale.invoiceNumber,
      date: sale.createdAt,
      branchName: sale.branch?.name || "",
      customerName: sale.customer?.name || "Walk-in Customer",
      customerPhone: sale.customer?.phone || "",
      items: itemRows.map((r) => ({
        productName: r.name,
        sku: r.sku,
        quantity: r.qty,
        unitPrice: r.price,
        total: r.total,
        serialNumbers: r.serials,
        attributeValues: r.variant ? r.variant.split(", ") : [],
      })),
      subtotal: Number(sale.totalAmount || 0),
      discountAmount: Number(sale.discount || 0),
      taxAmount: Number(sale.tax || 0),
      shippingCost: 0,
      grandTotal: Number(sale.grandTotal || 0),
      paidAmount: Number(sale.paidAmount || 0),
      receivedAmount: Number(sale.paidAmount || 0),
      changeAmount: Number(sale.changeAmount || 0),
      dueAmount: Number(sale.dueAmount || 0),
      paymentStatus: Number(sale.dueAmount || 0) > 0 ? "partial" : "paid",
      paymentMethod: sale.paymentMethod,
    };
    setInvoicePayload(payload);
    setInvoicePreviewOpen(true);
  };

  const loadAccounts = useCallback(async () => {
    try {
      const res = await apiFetch<AccountOption[] | { data?: AccountOption[] }>("/finance/accounts");
      const list = Array.isArray(res) ? res : res.data || [];
      setAccounts((Array.isArray(list) ? list : []).filter((a) => (a.isActive ?? true)));
    } catch {
      setAccounts([]);
    }
  }, []);

  const openPayModal = async () => {
    if (!sale) return;
    setPayAmount(String(Number(sale.dueAmount || 0)));
    setPayNote("");
    setPayAccountId("");
    await loadAccounts();
    setShowPayModal(true);
  };

  const submitDuePayment = async () => {
    if (!sale) return;
    const amount = Number(payAmount || 0);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > Number(sale.dueAmount || 0)) {
      toast.error("Amount cannot exceed due amount");
      return;
    }
    if (!payAccountId) {
      toast.error("Select an account");
      return;
    }

    setPayLoading(true);
    try {
      await apiFetch(`/sales/${sale.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          accountId: Number(payAccountId),
          amount,
          note: payNote.trim() || undefined,
        }),
      });
      toast.success("Payment added successfully");
      setShowPayModal(false);
      await Promise.all([loadSale(), loadPaymentHistory()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add payment");
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading sale details...</div>;
  }

  if (!sale) {
    return <div className="p-6 text-sm text-muted-foreground">Sale not found.</div>;
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={FileText}
        title={`Invoice ${sale.invoiceNumber}`}
        description="Seller-admin style sale details with item, payment, and return history."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => void loadSale()}
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          Refresh
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto"
          onClick={openInvoicePreview}
        >
          <FileText className="h-4 w-4 shrink-0" />
          Invoice
        </Button>
      </InventoryListPageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 sm:gap-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
          <InventorySectionHeader compact icon={User} title="Customer" description="Customer snapshot" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{sale.customer?.name || "Walk-in Customer"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{sale.customer?.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{sale.customer?.email || "—"}</span>
            </div>
          </div>
        </section>

        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
          <InventorySectionHeader compact icon={CalendarDays} title="Invoice" description="Basic invoice data" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice No</span>
              <span className="font-medium">{sale.invoiceNumber}</span>
            </div>
            {sale.order ? (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">E‑commerce order</span>
                <Link
                  href={`/ecommerce/orders/${sale.order.id}`}
                  className="font-medium text-primary text-right hover:underline"
                >
                  {sale.order.orderNumber}
                </Link>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Branch</span>
              <span className="font-medium">{sale.branch?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{formatDate(sale.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={sale.status} />
            </div>
          </div>
        </section>

        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
          <InventorySectionHeader compact icon={CreditCard} title="Payment" description="Payment totals" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium capitalize">{sale.paymentMethod?.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grand Total</span>
              <span className="font-semibold">{formatPrice(Number(sale.grandTotal || 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium text-green-600">{formatPrice(Number(sale.paidAmount || 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span className="font-medium text-red-600">{formatPrice(Number(sale.dueAmount || 0))}</span>
            </div>
            {Number(sale.changeAmount || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Change</span>
                <span className="font-medium">{formatPrice(Number(sale.changeAmount || 0))}</span>
              </div>
            )}
            {Number(sale.dueAmount || 0) > 0 && (
              <div className="pt-2">
                <Button type="button" className="w-full" onClick={() => void openPayModal()}>
                  Pay Due
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Package} title="Products" description="Products sold in this invoice" />
        </div>
        <div className="p-5 sm:p-6 md:p-7">
          <DataTable
            inventoryStyle
            columns={[
              { key: "index", label: "#", className: "w-12", render: (_: (typeof itemRows)[number], i: number) => i + 1 },
              {
                key: "name",
                label: "Product",
                render: (row: (typeof itemRows)[number]) => (
                  <div>
                    <p className="font-medium">{row.name}</p>
                    {row.variant ? <p className="text-xs text-muted-foreground">{row.variant}</p> : null}
                    {row.serials.length > 0 ? (
                      <p className="text-xs text-muted-foreground">IMEI: {row.serials.join(", ")}</p>
                    ) : null}
                  </div>
                ),
              },
              { key: "sku", label: "SKU" },
              { key: "qty", label: "Qty", className: "text-center" },
              { key: "price", label: "Unit", render: (row: (typeof itemRows)[number]) => formatPrice(row.price) },
              { key: "total", label: "Total", render: (row: (typeof itemRows)[number]) => <span className="font-semibold">{formatPrice(row.total)}</span> },
            ]}
            data={itemRows}
            loading={false}
          />
        </div>
      </section>

      {returnRows.length > 0 && (
        <section className={INVENTORY_CARD_SHELL}>
          <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
            <InventorySectionHeader compact icon={RotateCcw} title="Return History" description="Returns linked to this sale" />
          </div>
          <div className="p-5 sm:p-6 md:p-7">
            <DataTable
              inventoryStyle
              columns={[
                { key: "sl", label: "#", className: "w-12" },
                { key: "date", label: "Date", render: (r: (typeof returnRows)[number]) => formatDate(r.date) },
                { key: "items", label: "Items", className: "text-center" },
                { key: "reason", label: "Reason" },
                { key: "amount", label: "Amount", render: (r: (typeof returnRows)[number]) => <span className="font-medium text-red-600">{formatPrice(r.amount)}</span> },
              ]}
              data={returnRows}
              loading={false}
            />
          </div>
        </section>
      )}

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={CreditCard} title="Payment History" description="Payments recorded for this invoice" />
        </div>
        <div className="p-5 sm:p-6 md:p-7">
          <DataTable
            inventoryStyle
            columns={[
              { key: "index", label: "#", className: "w-12", render: (_: PaymentHistoryRow, i: number) => i + 1 },
              { key: "date", label: "Date", render: (row: PaymentHistoryRow) => formatDate(row.createdAt) },
              {
                key: "account",
                label: "Account",
                render: (row: PaymentHistoryRow) =>
                  row.account?.accountName || row.account?.name || "—",
              },
              {
                key: "type",
                label: "Type",
                render: (row: PaymentHistoryRow) => (
                  <span className="capitalize">{String(row.account?.accountType || row.account?.type || row.type || "—").replace("_", " ")}</span>
                ),
              },
              {
                key: "amount",
                label: "Amount",
                render: (row: PaymentHistoryRow) => <span className="font-medium text-green-600">{formatPrice(Number(row.amount || 0))}</span>,
              },
              { key: "note", label: "Note", render: (row: PaymentHistoryRow) => row.description || "—" },
            ]}
            data={paymentHistory}
            loading={false}
          />
        </div>
      </section>

      <InvoicePreviewModal
        open={invoicePreviewOpen}
        invoiceData={invoicePayload}
        onOpenChange={setInvoicePreviewOpen}
      />

      <Modal
        open={showPayModal}
        onOpenChange={setShowPayModal}
        title="Pay Due"
        description={sale ? `Invoice: ${sale.invoiceNumber}` : ""}
        className="max-w-md"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPayModal(false)} disabled={payLoading}>
              Cancel
            </Button>
            <Button onClick={() => void submitDuePayment()} disabled={payLoading}>
              {payLoading ? "Saving..." : "Pay"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            Current Due: <span className="font-semibold text-amber-700">{formatPrice(Number(sale?.dueAmount || 0))}</span>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              min={0}
              max={Number(sale?.dueAmount || 0)}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Account</label>
            <Select value={payAccountId} onValueChange={setPayAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={String(a.id)} value={String(a.id)}>
                    {a.accountName || a.name || String(a.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Note</label>
            <textarea
              rows={2}
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Optional note"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}


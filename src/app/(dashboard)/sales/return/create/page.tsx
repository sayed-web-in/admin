"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  FileText,
  Loader2,
  Package,
  RefreshCcw,
  Save,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { unwrapPaginated } from "@/lib/apiList";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReturnType = "good" | "damage" | "warranty";
type DamageType = "none" | "percentage" | "fixed";

type SaleLine = {
  id: number;
  quantity: number;
  unitPrice: number;
  total: number;
  storeProductId: number;
  returnedQuantity?: number;
  availableReturnQty?: number;
  serialNumbers?: Array<{ serial: string; status?: string }>;
  storeProduct?: {
    product?: { name?: string };
    productVariant?: { sku?: string | null };
  };
};

type SaleDetail = {
  id: number;
  invoiceNumber: string;
  status: string;
  branchId: number;
  grandTotal: number;
  createdAt: string;
  customer?: { name?: string };
  branch?: { name?: string };
  items: SaleLine[];
};

type LineState = {
  saleItemId: number;
  storeProductId: number;
  name: string;
  sku: string;
  available: number;
  returnQty: number;
  unitPrice: number;
  returnType: ReturnType;
  damageType: DamageType;
  damageValue: number;
  serialNumbers: string[];
  availableSerials: string[];
};

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function soldSerialsFromLine(line: SaleLine): string[] {
  const rows = line.serialNumbers ?? [];
  return rows
    .filter((r) => String(r.status || "").toUpperCase() === "SOLD")
    .map((r) => String(r.serial || "").trim())
    .filter(Boolean);
}

function CreateSalesReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefSaleId = searchParams.get("saleId");

  const branchId = getSelectedBranch();
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [lines, setLines] = useState<LineState[]>([]);
  const [loadingSale, setLoadingSale] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [returnDate, setReturnDate] = useState(getTodayLocalDate());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [reasonMain, setReasonMain] = useState("");

  const [serialOpen, setSerialOpen] = useState(false);
  const [serialLineId, setSerialLineId] = useState<number | null>(null);

  const hydrateFromSale = useCallback((s: SaleDetail) => {
    setSale(s);
    setLines(
      (s.items ?? []).map((it) => {
        const avail = Math.max(
          0,
          it.availableReturnQty ??
            it.quantity - (it.returnedQuantity ?? 0)
        );
        const serials = soldSerialsFromLine(it);
        return {
          saleItemId: it.id,
          storeProductId: it.storeProductId,
          name: it.storeProduct?.product?.name || "Product",
          sku: it.storeProduct?.productVariant?.sku || "—",
          available: avail,
          returnQty: 0,
          unitPrice: Number(it.unitPrice) || 0,
          returnType: "good",
          damageType: "none",
          damageValue: 0,
          serialNumbers: [],
          availableSerials: serials,
        };
      })
    );
  }, []);

  const loadSaleById = useCallback(
    async (id: number) => {
      setLoadingSale(true);
      try {
        const data = await apiFetch<SaleDetail>(`/sales/${id}`);
        if (data.status === "RETURNED") {
          toast.error("This sale is already fully returned.");
          setSale(null);
          setLines([]);
          return;
        }
        if (branchId && data.branchId !== Number(branchId)) {
          toast.error("This invoice belongs to another branch. Switch branch header to match.");
          setSale(null);
          setLines([]);
          return;
        }
        hydrateFromSale(data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load sale");
        setSale(null);
        setLines([]);
      } finally {
        setLoadingSale(false);
      }
    },
    [branchId, hydrateFromSale]
  );

  useEffect(() => {
    if (!prefSaleId) return;
    const id = parseInt(prefSaleId, 10);
    if (!Number.isFinite(id) || id < 1) return;
    void loadSaleById(id);
  }, [prefSaleId, loadSaleById]);

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) {
      toast.error("Enter invoice number");
      return;
    }
    if (!branchId) {
      toast.error("Select a branch from the header first.");
      return;
    }
    setSearching(true);
    try {
      const qs = new URLSearchParams({
        search: invoiceSearch.trim(),
        page: "1",
        limit: "8",
        branchId: String(branchId),
      });
      const res = await apiFetch<unknown>(`/sales?${qs}`);
      const p = unwrapPaginated<{ id: number }>(res);
      const list = p?.data ?? [];
      if (!list.length) {
        toast.error("No sale found for this search in the selected branch.");
        setSale(null);
        setLines([]);
        return;
      }
      await loadSaleById(list[0].id);
      toast.success(`Loaded invoice ${invoiceSearch.trim()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const updateLine = (saleItemId: number, patch: Partial<LineState>) => {
    setLines((prev) =>
      prev.map((row) => {
        if (row.saleItemId !== saleItemId) return row;
        const next = { ...row, ...patch };
        if (patch.returnQty !== undefined) {
          const q = Math.min(Math.max(0, next.returnQty), next.available);
          next.returnQty = q;
          next.serialNumbers = next.serialNumbers.slice(0, q);
        }
        if (patch.damageType !== undefined || patch.damageValue !== undefined) {
          if (next.damageType === "percentage") {
            next.damageValue = Math.min(100, Math.max(0, next.damageValue));
          } else if (next.damageType === "fixed") {
            next.damageValue = Math.max(0, next.damageValue);
          }
        }
        return next;
      })
    );
  };

  const lineDamage = (row: LineState): number => {
    const lineTotal = row.returnQty * row.unitPrice;
    if (row.damageType === "percentage" && row.damageValue > 0) {
      return (lineTotal * Math.min(100, row.damageValue)) / 100;
    }
    if (row.damageType === "fixed" && row.damageValue > 0) {
      return Math.min(lineTotal, row.damageValue);
    }
    return 0;
  };

  const subtotal = useMemo(
    () => lines.reduce((s, r) => s + r.returnQty * r.unitPrice, 0),
    [lines]
  );
  const damageTotal = useMemo(() => lines.reduce((s, r) => s + lineDamage(r), 0), [lines]);
  const refundPreview = subtotal - damageTotal;

  const openSerial = (row: LineState) => {
    if (row.availableSerials.length === 0) return;
    setSerialLineId(row.saleItemId);
    setSerialOpen(true);
  };

  const toggleSerial = (saleItemId: number, serial: string, checked: boolean) => {
    setLines((prev) =>
      prev.map((row) => {
        if (row.saleItemId !== saleItemId) return row;
        const has = row.serialNumbers.includes(serial);
        const next = checked
          ? has
            ? row.serialNumbers
            : [...row.serialNumbers, serial]
          : row.serialNumbers.filter((s) => s !== serial);
        return { ...row, serialNumbers: next, returnQty: next.length };
      })
    );
  };

  const submit = async () => {
    if (!sale) {
      toast.error("Load an invoice first");
      return;
    }
    const picked = lines.filter((r) => r.returnQty > 0);
    if (!picked.length) {
      toast.error("Enter return quantity for at least one line.");
      return;
    }
    for (const r of picked) {
      if (r.availableSerials.length > 0 && r.serialNumbers.length !== r.returnQty) {
        toast.error(`${r.name}: select ${r.returnQty} IMEI(s) for this return quantity.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const metaBlocks: string[] = [];
      if (returnDate.trim()) metaBlocks.push(`Return date: ${returnDate.trim()}`);
      if (reference.trim()) metaBlocks.push(`Reference: ${reference.trim()}`);
      if (responsiblePerson.trim()) metaBlocks.push(`Responsible: ${responsiblePerson.trim()}`);
      if (notes.trim()) metaBlocks.push(`Notes: ${notes.trim()}`);
      picked.forEach((r, idx) => {
        metaBlocks.push(
          `Line ${idx + 1} (${r.name}): type=${r.returnType}` +
            (r.damageType !== "none" ? `, damage=${r.damageType} ${r.damageValue}` : "")
        );
      });
      const reasonCombined =
        [metaBlocks.join("\n"), reasonMain.trim()].filter(Boolean).join("\n\n") || undefined;

      const created = await apiFetch<{ id: number; status?: string }>("/sales/return", {
        method: "POST",
        body: JSON.stringify({
          saleId: sale.id,
          reason: reasonCombined,
          returnDate: returnDate.trim() || undefined,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          responsiblePerson: responsiblePerson.trim() || undefined,
          items: picked.map((r) => ({
            saleItemId: r.saleItemId,
            storeProductId: r.storeProductId,
            quantity: r.returnQty,
            unitPrice: r.unitPrice,
            returnType: r.returnType,
            serialNumbers: r.availableSerials.length ? r.serialNumbers : undefined,
            damageDeductionType: r.damageType !== "none" ? r.damageType : undefined,
            damageDeductionValue:
              r.damageType !== "none" && r.damageValue > 0 ? r.damageValue : undefined,
          })),
        }),
      });
      if (created?.status === "pending" && created.id) {
        toast.success("Return saved — record the cash refund on the return detail page.");
        router.push(`/sales/return/${created.id}`);
      } else {
        toast.success("Sales return saved");
        router.push("/sales/return");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit return");
    } finally {
      setSubmitting(false);
    }
  };

  const serialRow = serialLineId != null ? lines.find((l) => l.saleItemId === serialLineId) : null;

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={FileText}
        title="Create sales return"
        description="Invoice search, IMEI, damage (return gain). Due and advance adjust on save; cash refund is completed from the return detail page."
      >
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
          <Link href="/sales/return">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        {sale ? (
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
            <Link href={`/sales/history/${sale.id}`}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              View sale
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="h-10 rounded-xl sm:h-9"
          disabled={!sale || submitting}
          onClick={() => void submit()}
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save return
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 space-y-4`}>
        <InventorySectionHeader
          compact
          icon={Search}
          title="Find invoice"
          description="Search is limited to the branch selected in the header (same as seller-admin store scope)."
        />
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Invoice number…"
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void searchInvoice()}
            className="max-w-md"
            disabled={!branchId}
          />
          <Button type="button" onClick={() => void searchInvoice()} disabled={searching || !branchId}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {!branchId ? (
          <p className="text-sm text-amber-600">Pick a branch in the header to search and post stock to the correct store.</p>
        ) : null}
        {loadingSale ? <p className="text-sm text-muted-foreground">Loading sale…</p> : null}
      </section>

      {sale ? (
        <>
          <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 space-y-4`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Customer</p>
                <p className="font-medium">{sale.customer?.name || "Walk-in"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Invoice</p>
                <p className="font-medium">{sale.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Branch</p>
                <p className="font-medium">{sale.branch?.name || "—"}</p>
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Return date</label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs text-muted-foreground">Reference</label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Responsible person</label>
                <Input value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reason / memo</label>
              <textarea
                className="mt-1 flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={reasonMain}
                onChange={(e) => setReasonMain(e.target.value)}
                placeholder="Optional summary shown on the return record"
              />
            </div>
          </section>

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6">
              <InventorySectionHeader compact icon={Package} title="Lines to return" description="Qty, type, damage deduction, IMEI" />
            </div>
            <div className="overflow-x-auto p-3 sm:p-4">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Product</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2 text-center">Available</th>
                    <th className="p-2 text-center">Return qty</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Damage</th>
                    <th className="p-2">IMEI</th>
                    <th className="p-2 text-right">Unit</th>
                    <th className="p-2 text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row) => (
                    <tr key={row.saleItemId} className="border-b border-border/40">
                      <td className="p-2 font-medium">{row.name}</td>
                      <td className="p-2 text-muted-foreground">{row.sku}</td>
                      <td className="p-2 text-center">{row.available}</td>
                      <td className="p-2 text-center">
                        <Input
                          type="number"
                          className="mx-auto h-9 w-20 text-center"
                          min={0}
                          max={row.available}
                          value={row.returnQty === 0 ? "" : row.returnQty}
                          onChange={(e) =>
                            updateLine(row.saleItemId, { returnQty: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={row.returnType}
                          onValueChange={(v) => updateLine(row.saleItemId, { returnType: v as ReturnType })}
                        >
                          <SelectTrigger className="h-9 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="damage">Damage</SelectItem>
                            <SelectItem value="warranty">Warranty</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={row.damageType}
                            onValueChange={(v) => updateLine(row.saleItemId, { damageType: v as DamageType })}
                          >
                            <SelectTrigger className="h-9 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="percentage">%</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                          {row.damageType !== "none" ? (
                            <Input
                              type="number"
                              className="h-9 w-20"
                              min={0}
                              value={row.damageValue || ""}
                              onChange={(e) =>
                                updateLine(row.saleItemId, { damageValue: Number(e.target.value) || 0 })
                              }
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={row.availableSerials.length === 0}
                          onClick={() => openSerial(row)}
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                          {row.availableSerials.length
                            ? `${row.serialNumbers.length}/${row.availableSerials.length}`
                            : "—"}
                        </Button>
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          className="ml-auto h-9 w-24 text-right"
                          value={row.unitPrice}
                          onChange={(e) =>
                            updateLine(row.saleItemId, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatPrice(row.returnQty * row.unitPrice - lineDamage(row))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="text-sm text-muted-foreground">Refund (customer)</p>
              <p className="text-2xl font-bold text-primary">{formatPrice(refundPreview)}</p>
              <p className="text-xs text-muted-foreground">
                Gross {formatPrice(subtotal)} − damage {formatPrice(damageTotal)} · Return gain (P&L){" "}
                {formatPrice(damageTotal)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/sales/return">Cancel</Link>
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void submit()}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Submit return
              </Button>
            </div>
          </section>
        </>
      ) : null}

      <Modal open={serialOpen} onOpenChange={setSerialOpen} title="Select IMEI / serial" className="max-w-lg">
        {serialRow ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{serialRow.name}</p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {serialRow.availableSerials.map((serial) => {
                const on = serialRow.serialNumbers.includes(serial);
                return (
                  <label
                    key={serial}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggleSerial(serialRow.saleItemId, serial, e.target.checked)}
                    />
                    <span className="font-mono text-sm">{serial}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setSerialOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default function CreateSalesReturnPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <CreateSalesReturnContent />
    </Suspense>
  );
}

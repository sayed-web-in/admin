"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Loader2,
  Package,
  RefreshCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
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
import { cn } from "@/lib/utils";

type SerialRow = { serial: string; status?: string };

type PurchaseLine = {
  id: number;
  quantity: number;
  unitCost: number;
  storeProductId: number;
  availableReturnQty?: number;
  availableSerials?: string[];
  serialNumbers?: SerialRow[];
  storeProduct?: {
    product?: { name?: string };
    productVariant?: {
      sku?: string | null;
      attributes?: { attributeValue?: { value?: string } | null }[] | null;
    } | null;
  };
};

type PurchaseForReturn = {
  id: number;
  referenceNo: string;
  createdAt?: string;
  supplier?: { name?: string; company?: string | null };
  branch?: { name?: string };
  items: PurchaseLine[];
};

type ReturnType = "good" | "damage" | "warranty";

type ReturnItemState = {
  purchaseItemId: number;
  storeProductId: number;
  productName: string;
  sku: string | null;
  purchaseQuantity: number;
  returnQuantity: number;
  unitCost: number;
  returnType: ReturnType;
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

function variantLabel(line: PurchaseLine): string | undefined {
  const attrs = line.storeProduct?.productVariant?.attributes;
  if (!attrs?.length) return undefined;
  const parts = attrs
    .map((a) => a.attributeValue?.value)
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" / ") : undefined;
}

function CreatePurchaseReturnPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledKey = useRef<string | null>(null);

  const fromPurchaseIdUrl = Boolean(searchParams.get("purchaseId")?.trim());

  const [refSearch, setRefSearch] = useState("");
  const [purchase, setPurchase] = useState<PurchaseForReturn | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
  const [returnDate, setReturnDate] = useState(getTodayLocalDate());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [reasonMain, setReasonMain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchingRef, setSearchingRef] = useState(false);
  const [loadingPurchaseId, setLoadingPurchaseId] = useState(false);
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [serialModalItemId, setSerialModalItemId] = useState<number | null>(null);

  const selectedBranchId = getSelectedBranch();

  const hydrateFromPurchase = useCallback((full: PurchaseForReturn) => {
    setPurchase(full);
    setReturnItems(
      (full.items || []).map((line) => {
        const availableSerials =
          line.availableSerials?.length && line.availableSerials.length > 0
            ? line.availableSerials
            : (line.serialNumbers ?? [])
                .filter((s) => String(s?.status ?? "").toUpperCase() === "IN_STOCK")
                .map((s) => String(s.serial));
        const pq = Math.max(
          0,
          Math.min(
            Number(line.quantity) || 0,
            Number(line.availableReturnQty ?? line.quantity) || 0
          )
        );
        return {
          purchaseItemId: line.id,
          storeProductId: line.storeProductId,
          productName: line.storeProduct?.product?.name || "Product",
          sku: line.storeProduct?.productVariant?.sku ?? null,
          purchaseQuantity: pq,
          returnQuantity: 0,
          unitCost: Number(line.unitCost) || 0,
          returnType: "good",
          serialNumbers: [],
          availableSerials,
        };
      })
    );
  }, []);

  const loadPurchaseById = useCallback(
    async (id: number) => {
      setLoadingPurchaseId(true);
      try {
        const full = await apiFetch<PurchaseForReturn>(`/purchases/${id}`);
        hydrateFromPurchase(full);
        setRefSearch(full.referenceNo || "");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load purchase");
        setPurchase(null);
        setReturnItems([]);
      } finally {
        setLoadingPurchaseId(false);
      }
    },
    [hydrateFromPurchase]
  );

  const lookupPurchaseByRef = useCallback(
    async (reference: string) => {
      const trimmed = reference.trim();
      if (!trimmed) {
        toast.error("Enter a purchase reference");
        return;
      }
      setSearchingRef(true);
      try {
        const qs = new URLSearchParams({
          search: trimmed,
          page: "1",
          limit: "5",
        });
        if (selectedBranchId) qs.set("branchId", String(selectedBranchId));
        const res = await apiFetch<unknown>(`/purchases?${qs.toString()}`);
        const p = unwrapPaginated<{ id: number }>(res);
        const list = p?.data ?? [];
        if (list.length === 0) {
          toast.error("Purchase not found");
          setPurchase(null);
          setReturnItems([]);
          return;
        }
        const hit = list[0] as { id: number };
        await loadPurchaseById(hit.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Search failed");
        setPurchase(null);
        setReturnItems([]);
      } finally {
        setSearchingRef(false);
      }
    },
    [loadPurchaseById, selectedBranchId]
  );

  useEffect(() => {
    const purchaseIdRaw = searchParams.get("purchaseId")?.trim();
    const ref = searchParams.get("ref")?.trim();
    const key = purchaseIdRaw ? `id:${purchaseIdRaw}` : ref ? `ref:${ref}` : "";
    if (!key || prefilledKey.current === key) return;
    prefilledKey.current = key;

    if (purchaseIdRaw) {
      const id = parseInt(purchaseIdRaw, 10);
      if (Number.isFinite(id) && id > 0) {
        void loadPurchaseById(id);
        return;
      }
    }
    if (ref) {
      setRefSearch(ref);
      void lookupPurchaseByRef(ref);
    }
  }, [searchParams, loadPurchaseById, lookupPurchaseByRef]);

  const updateReturnItem = (purchaseItemId: number, changes: Partial<ReturnItemState>) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.purchaseItemId !== purchaseItemId) return item;
        const nextQty =
          changes.returnQuantity !== undefined
            ? Math.max(0, Math.min(changes.returnQuantity, item.purchaseQuantity))
            : item.returnQuantity;
        return {
          ...item,
          ...changes,
          returnQuantity: nextQty,
          unitCost: changes.unitCost !== undefined ? Math.max(0, changes.unitCost) : item.unitCost,
          serialNumbers:
            changes.returnQuantity !== undefined
              ? item.serialNumbers.slice(0, nextQty)
              : item.serialNumbers,
        };
      })
    );
  };

  const totalReturnAmount = useMemo(
    () => returnItems.reduce((sum, item) => sum + item.returnQuantity * item.unitCost, 0),
    [returnItems]
  );

  const totalReturnQuantity = useMemo(
    () => returnItems.reduce((sum, item) => sum + item.returnQuantity, 0),
    [returnItems]
  );

  const modalItem = useMemo(
    () => returnItems.find((i) => i.purchaseItemId === serialModalItemId) ?? null,
    [returnItems, serialModalItemId]
  );

  const openSerialModal = (item: ReturnItemState) => {
    setSerialModalItemId(item.purchaseItemId);
    setSerialModalOpen(true);
  };

  const toggleSerialOnModalItem = (serial: string, checked: boolean) => {
    if (!serialModalItemId) return;
    setReturnItems((prev) =>
      prev.map((item) =>
        item.purchaseItemId === serialModalItemId
          ? (() => {
              const already = item.serialNumbers.includes(serial);
              const next = checked
                ? already
                  ? item.serialNumbers
                  : [...item.serialNumbers, serial]
                : item.serialNumbers.filter((s) => s !== serial);
              return {
                ...item,
                serialNumbers: next,
                returnQuantity: next.length,
              };
            })()
          : item
      )
    );
  };

  const handleSerialChipRemove = (purchaseItemId: number, serial: string) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.purchaseItemId !== purchaseItemId) return item;
        const next = item.serialNumbers.filter((s) => s !== serial);
        return {
          ...item,
          serialNumbers: next,
          returnQuantity: next.length,
        };
      })
    );
  };

  const handleSubmit = async () => {
    if (!purchase) {
      toast.error("Load a purchase first");
      return;
    }
    const hasQty = returnItems.some((item) => item.returnQuantity > 0);
    if (!hasQty) {
      toast.error("Enter return quantity for at least one line.");
      return;
    }

    const withImei = returnItems.filter(
      (item) => item.returnQuantity > 0 && item.availableSerials.length > 0
    );
    for (const item of withImei) {
      if (item.serialNumbers.length !== item.returnQuantity) {
        toast.error(
          `${item.productName}: select ${item.returnQuantity} IMEI(s) (currently ${item.serialNumbers.length}).`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: number }>("/purchases/return", {
        method: "POST",
        body: JSON.stringify({
          purchaseId: purchase.id,
          returnDate: returnDate.trim() || undefined,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          responsiblePerson: responsiblePerson.trim() || undefined,
          reason: reasonMain.trim() || undefined,
          items: returnItems
            .filter((item) => item.returnQuantity > 0)
            .map((item) => ({
              storeProductId: item.storeProductId,
              quantity: item.returnQuantity,
              unitCost: item.unitCost,
              returnType: item.returnType,
              serialNumbers:
                item.availableSerials.length > 0 ? item.serialNumbers : undefined,
            })),
        }),
      });
      toast.success("Purchase return created.");
      const newId = created?.id;
      if (newId != null && Number.isFinite(Number(newId))) {
        router.push(`/purchases/return/${newId}`);
      } else {
        router.push("/purchases/return");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create return");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={RefreshCcw}
        title="Create purchase return"
        description={
          loadingPurchaseId
            ? "Loading purchase…"
            : purchase
              ? `${purchase.referenceNo} · ${purchase.branch?.name ?? "Branch"}`
              : "Find a purchase, then set return quantities, types, and IMEIs like seller-admin."
        }
      >
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
          <Link href="/purchases/return">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        {purchase ? (
          <>
            <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
              <Link href={`/purchases/${purchase.id}`}>
                <RefreshCcw className="mr-2 h-4 w-4" /> View purchase
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-10 rounded-xl sm:h-9"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {submitting ? "Saving…" : "Save return"}
            </Button>
          </>
        ) : null}
      </InventoryListPageHeader>

      {!fromPurchaseIdUrl ? (
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            compact
            icon={Search}
            title="Find purchase"
            description="Search by reference, or open this page with ?purchaseId= or ?ref= from the purchase list or purchase detail."
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium">Purchase reference</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. PUR-…"
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void lookupPurchaseByRef(refSearch)}
                  disabled={loadingPurchaseId}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void lookupPurchaseByRef(refSearch)}
                  disabled={searchingRef || loadingPurchaseId}
                >
                  {searchingRef ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {loadingPurchaseId ? (
        <section className={`${INVENTORY_CARD_SHELL} flex items-center justify-center gap-2 p-12 text-muted-foreground`}>
          <Loader2 className="size-5 animate-spin" />
          Loading purchase…
        </section>
      ) : purchase ? (
        <>
          <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Supplier</p>
                <p className="font-semibold">{purchase.supplier?.name ?? "—"}</p>
                {purchase.supplier?.company ? (
                  <p className="text-sm text-muted-foreground">{purchase.supplier.company}</p>
                ) : null}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Purchase date</p>
                <p className="font-medium">
                  {purchase.createdAt ? formatDate(purchase.createdAt) : "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Branch</p>
                <p className="font-medium">{purchase.branch?.name ?? "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Return date
                </label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Reference</label>
                <Input
                  placeholder="Document / RMA no."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Responsible person</label>
                <Input
                  placeholder="Staff name"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Notes</label>
                <textarea
                  className="flex min-h-[40px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Condition, carrier, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium">Reason (optional)</label>
              <textarea
                className="flex min-h-[72px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Summary reason (metadata above is stored too)"
                value={reasonMain}
                onChange={(e) => setReasonMain(e.target.value)}
              />
            </div>
          </section>

          <section className={INVENTORY_CARD_SHELL}>
            <div className="flex flex-col gap-2 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
              <div>
                <InventorySectionHeader compact icon={Package} title="Product details" />
                <p className="mt-1 text-sm text-muted-foreground">Return qty, type, unit cost, and IMEI selection</p>
              </div>
              <p className="text-sm text-muted-foreground">Lines: {purchase.items.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">Product</th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">SKU</th>
                    <th className="px-3 py-3 text-center font-medium text-muted-foreground">Available</th>
                    <th className="px-3 py-3 text-center font-medium text-muted-foreground">Return qty</th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">Return type</th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">IMEI / Serial</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground">Unit cost</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {returnItems.map((item) => {
                    const line = purchase.items.find((l) => l.id === item.purchaseItemId);
                    const v = line ? variantLabel(line) : undefined;
                    return (
                      <tr key={item.purchaseItemId} className="bg-background/50">
                        <td className="px-3 py-3 align-top">
                          <p className="font-medium">{item.productName}</p>
                          {v ? <p className="text-xs text-muted-foreground">{v}</p> : null}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">{item.sku ?? "—"}</td>
                        <td className="px-3 py-3 text-center align-top tabular-nums">{item.purchaseQuantity}</td>
                        <td className="px-3 py-3 text-center align-top">
                          <Input
                            type="number"
                            min={0}
                            max={item.purchaseQuantity}
                            className="mx-auto h-9 w-24 text-center"
                            value={item.returnQuantity === 0 ? "" : item.returnQuantity}
                            onChange={(e) =>
                              updateReturnItem(item.purchaseItemId, {
                                returnQuantity: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Select
                            value={item.returnType}
                            onValueChange={(v) =>
                              updateReturnItem(item.purchaseItemId, {
                                returnType: v as ReturnType,
                              })
                            }
                          >
                            <SelectTrigger className="h-9 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="good">Good return</SelectItem>
                              <SelectItem value="damage">Damaged</SelectItem>
                              <SelectItem value="warranty">Warranty</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="max-w-[220px] space-y-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-full gap-1 text-xs"
                              disabled={item.availableSerials.length === 0}
                              onClick={() => openSerialModal(item)}
                            >
                              <CheckSquare className="size-3.5 shrink-0" />
                              {item.availableSerials.length > 0
                                ? `IMEI (${item.serialNumbers.length}/${item.availableSerials.length})`
                                : "No IMEI"}
                            </Button>
                            {item.serialNumbers.length > 0 ? (
                              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                                {item.serialNumbers.map((sn) => (
                                  <span
                                    key={sn}
                                    className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px]"
                                  >
                                    {sn}
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() => handleSerialChipRemove(item.purchaseItemId, sn)}
                                      aria-label="Remove"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right align-top">
                          <Input
                            type="number"
                            min={0}
                            className="ml-auto h-9 w-24 text-right"
                            value={item.unitCost}
                            onChange={(e) =>
                              updateReturnItem(item.purchaseItemId, {
                                unitCost: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-3 text-right align-top font-medium tabular-nums">
                          {formatPrice(item.returnQuantity * item.unitCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Return summary</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{formatPrice(totalReturnAmount)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total return quantity: {totalReturnQuantity}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" type="button" asChild>
                  <Link href="/purchases/return">Cancel</Link>
                </Button>
                <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
                  {submitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 size-4" />
                  )}
                  {submitting ? "Saving…" : "Submit return"}
                </Button>
              </div>
            </div>
          </section>
        </>
      ) : fromPurchaseIdUrl && !loadingPurchaseId ? (
        <section className={`${INVENTORY_CARD_SHELL} p-8 text-center text-muted-foreground`}>
          Could not load purchase. Check the link or use reference search above.
        </section>
      ) : null}

      <Modal
        open={serialModalOpen}
        onOpenChange={(o) => {
          setSerialModalOpen(o);
          if (!o) setSerialModalItemId(null);
        }}
        title="Select IMEI / serial"
        description={modalItem?.productName}
        className="max-w-lg"
        footer={
          <Button type="button" onClick={() => setSerialModalOpen(false)}>
            Done
          </Button>
        }
      >
        {modalItem ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Selected {modalItem.serialNumbers.length} of {modalItem.availableSerials.length}
            </p>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {modalItem.availableSerials.map((serial) => {
                const selected = modalItem.serialNumbers.includes(serial);
                return (
                  <label
                    key={serial}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                      selected ? "border-primary/40 bg-primary/10" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => toggleSerialOnModalItem(serial, e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    <span className="flex-1 font-mono text-sm">{serial}</span>
                    {selected ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : null}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default function CreatePurchaseReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <CreatePurchaseReturnPageContent />
    </Suspense>
  );
}

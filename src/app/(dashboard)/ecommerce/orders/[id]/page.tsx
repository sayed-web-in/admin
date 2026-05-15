"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  Package,
  Smartphone,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { formatPrice, cn, formatDateTimeFullShort, formatDateTimeMedShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  InventoryListPageHeader,
  InventorySectionHeader,
  INVENTORY_CARD_SHELL,
} from "@/components/inventory/InventoryCrudLayout";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

interface OrderItemRow {
  id: number;
  storeProductId: number;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  cancelled?: boolean;
  storeProduct: {
    branchId: number;
    branch?: { id: number; name: string };
    product: {
      hasImei: boolean;
      name: string;
      images: { url: string }[];
    };
    productVariant?: {
      image?: string | null;
      attributes: { attributeValue: { value: string } }[];
    } | null;
  };
}

interface TrackingRow {
  id: number;
  status: string;
  note?: string | null;
  createdAt: string;
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  name: string;
  phone: string;
  division: string;
  district: string;
  address: string;
  totalAmount: string | number;
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
  items: OrderItemRow[];
  tracking: TrackingRow[];
  sale?: { id: number; invoiceNumber: string } | null;
}

interface SerialOpt {
  id: number;
  serial: string;
}

interface AccountOption {
  id: string | number;
  name?: string;
  accountName?: string;
  accountType?: string;
  type?: string;
  isActive?: boolean;
}

const STATUS_NEXT: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

function variantLabel(item: OrderItemRow): string | undefined {
  const attrs = item.storeProduct.productVariant?.attributes;
  if (!attrs?.length) return undefined;
  return attrs.map((a) => a.attributeValue.value).join(" · ");
}

function imgSrc(url: string | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  return resolveMediaUrl(u);
}

function linePrimaryImageUrl(line: OrderItemRow): string | undefined {
  const v = line.storeProduct.productVariant?.image?.trim();
  if (v) return v;
  return line.storeProduct.product.images?.[0]?.url;
}

function OrderLineImeiCombobox({
  quantity,
  serials,
  selected,
  disabled,
  loading,
  onChange,
}: {
  quantity: number;
  serials: string[];
  selected: string[];
  disabled: boolean;
  loading: boolean;
  onChange: (next: string[]) => void;
}) {
  const anchor = useComboboxAnchor();
  return (
    <Combobox
      multiple
      autoHighlight
      items={serials}
      value={selected}
      onValueChange={(v) => {
        const next = v ?? [];
        if (next.length > quantity) {
          toast.message(`This line needs exactly ${quantity} IMEI(s)`);
          onChange(next.slice(0, quantity));
          return;
        }
        onChange(next);
      }}
    >
      <ComboboxChips
        ref={anchor}
        className="w-full min-h-9 max-h-32 overflow-y-auto rounded-lg border border-border bg-background px-2 py-1.5"
      >
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map((value) => (
                <ComboboxChip key={value} className="font-mono text-[11px]">
                  {value}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={
                  loading
                    ? "Loading serials…"
                    : serials.length === 0
                      ? "No serials in stock"
                      : `Search & pick ${quantity} IMEI (selected ${values.length}/${quantity})`
                }
                disabled={disabled || loading || serials.length === 0}
                className="min-w-[160px] border-0 bg-transparent text-xs focus:ring-0 focus:outline-none"
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent
        anchor={anchor}
        side="bottom"
        className="max-h-56 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
      >
        <ComboboxEmpty className="py-3 text-center text-xs text-muted-foreground">
          {loading ? "Loading…" : "No matching IMEI / serial."}
        </ComboboxEmpty>
        <ComboboxList className="max-h-48 overflow-y-auto p-1">
          {(item: string) => (
            <ComboboxItem
              key={item}
              value={item}
              className="rounded-md px-2 py-1.5 font-mono text-xs"
            >
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export default function EcommerceOrderDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusNote, setStatusNote] = useState("");
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [statusSaving, setStatusSaving] = useState(false);

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [paymentAccountId, setPaymentAccountId] = useState<string>("");

  const [serialOptions, setSerialOptions] = useState<
    Record<number, SerialOpt[]>
  >({});
  const [serialLoading, setSerialLoading] = useState<Record<number, boolean>>(
    {}
  );
  const [selectedSerials, setSelectedSerials] = useState<
    Record<number, string[]>
  >({});

  const [completeLoading, setCompleteLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancellingLineId, setCancellingLineId] = useState<number | null>(null);

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(id) || id < 1) return;
    setLoading(true);
    try {
      const o = await apiFetch<OrderDetail>(`/orders/${id}`);
      setOrder(o);
      const init: Record<number, string[]> = {};
      for (const line of o.items) {
        if (line.cancelled) continue;
        if (line.storeProduct.product.hasImei) init[line.id] = [];
      }
      setSelectedSerials(init);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Order not found");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const loadSerialsForLine = useCallback(
    async (line: OrderItemRow) => {
      if (!line.storeProduct.product.hasImei) return;
      setSerialLoading((m) => ({ ...m, [line.id]: true }));
      try {
        const res = await apiFetch<{
          hasImei: boolean;
          serials: SerialOpt[];
        }>(`/products/store/${line.storeProductId}/available-serials`);
        setSerialOptions((m) => ({ ...m, [line.id]: res.serials ?? [] }));
      } catch {
        toast.error("Could not load IMEI list for a line item");
        setSerialOptions((m) => ({ ...m, [line.id]: [] }));
      } finally {
        setSerialLoading((m) => ({ ...m, [line.id]: false }));
      }
    },
    []
  );

  useEffect(() => {
    if (!order) return;
    for (const line of order.items) {
      if (line.cancelled) continue;
      if (line.storeProduct.product.hasImei) {
        loadSerialsForLine(line);
      }
    }
  }, [order, loadSerialsForLine]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<AccountOption[] | { data?: AccountOption[] }>(
          "/finance/accounts"
        );
        const list = Array.isArray(res) ? res : res.data || [];
        const normalized = Array.isArray(list)
          ? list.filter((a) => a && a.id != null && (a.isActive ?? true))
          : [];
        setAccounts(normalized);
        const cash =
          normalized.find(
            (a) =>
              String(a.accountType ?? a.type ?? "").toLowerCase() === "cash"
          ) ?? normalized[0];
        if (cash) setPaymentAccountId(String(cash.id));
        else setPaymentAccountId("");
      } catch {
        setAccounts([]);
      }
    })();
  }, []);

  const firstActiveLine = order?.items.find((l) => !l.cancelled);
  const branchId = firstActiveLine?.storeProduct.branchId;
  const branchName = firstActiveLine?.storeProduct.branch?.name;
  const activeLineCount = order?.items.filter((l) => !l.cancelled).length ?? 0;

  const canUpdateStatus =
    order &&
    order.status !== "CANCELLED" &&
    order.status !== "DELIVERED" &&
    !order.sale;

  const canComplete =
    order &&
    !order.sale &&
    order.status !== "CANCELLED" &&
    order.status !== "DELIVERED" &&
    activeLineCount > 0 &&
    branchId != null;

  const canCancel =
    order &&
    !order.sale &&
    order.status !== "DELIVERED" &&
    order.status !== "CANCELLED";

  const imeiValid = useMemo(() => {
    if (!order) return false;
    for (const line of order.items) {
      if (line.cancelled) continue;
      if (!line.storeProduct.product.hasImei) continue;
      const picked = selectedSerials[line.id] ?? [];
      if (picked.length !== line.quantity) return false;
      if (new Set(picked).size !== picked.length) return false;
    }
    return true;
  }, [order, selectedSerials]);

  const setImeiSelection = (lineId: number, maxQty: number, values: string[]) => {
    const next = values ?? [];
    if (next.length > maxQty) {
      toast.message(`Select at most ${maxQty} IMEI(s) for this line`);
      setSelectedSerials((prev) => ({
        ...prev,
        [lineId]: next.slice(0, maxQty),
      }));
      return;
    }
    setSelectedSerials((prev) => ({ ...prev, [lineId]: next }));
  };

  const handleStatusUpdate = async () => {
    if (!order || !nextStatus) return;
    setStatusSaving(true);
    try {
      await apiFetch(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          ...(statusNote.trim() ? { note: statusNote.trim() } : {}),
        }),
      });
      toast.success("Status updated");
      setStatusNote("");
      setNextStatus("");
      await loadOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!order || branchId == null) return;
    const accountNum = Number(paymentAccountId);
    if (!Number.isFinite(accountNum) || accountNum < 1) {
      toast.error("Select a payment account — sale cannot complete without one");
      return;
    }
    if (accounts.length === 0) {
      toast.error("No active accounts. Add one under Finance → Accounts first.");
      return;
    }
    if (!imeiValid) {
      toast.error("Select the correct number of IMEI/serial for each line");
      return;
    }
    const imeiLines = order.items
      .filter((l) => !l.cancelled && l.storeProduct.product.hasImei)
      .map((l) => ({
        orderItemId: l.id,
        serialNumbers: selectedSerials[l.id] ?? [],
      }));
    setCompleteLoading(true);
    try {
      await apiFetch(`/orders/${order.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          branchId,
          paymentMethod: order.paymentMethod || "cod",
          paymentAccountId: accountNum,
          ...(imeiLines.length ? { imeiLines } : {}),
        }),
      });
      toast.success("Order completed — stock sold with selected IMEIs");
      await loadOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Complete failed");
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleCancelLine = async (line: OrderItemRow) => {
    if (!order || line.cancelled) return;
    if (
      !window.confirm(
        `Cancel this product line only? (${line.storeProduct.product.name})`,
      )
    )
      return;
    setCancellingLineId(line.id);
    try {
      await apiFetch(`/orders/${order.id}/items/${line.id}/cancel`, {
        method: "POST",
      });
      toast.success("Line cancelled");
      await loadOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingLineId(null);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    if (!window.confirm("Cancel this order? Inventory stays untouched until sell-out.")) return;
    setCancelLoading(true);
    try {
      await apiFetch(`/orders/${order.id}/cancel`, { method: "POST" });
      toast.success("Order cancelled");
      await loadOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted-foreground">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
          <p>Order not found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ecommerce/orders" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Orders
          </Link>
        </Button>
      </div>

      <InventoryListPageHeader
        icon={Package}
        title={order.orderNumber}
        description={`Placed ${formatDateTimeFullShort(new Date(order.createdAt).toISOString())} · ${order.items.length} line(s)`}
      >
        <StatusBadge status={order.status} />
      </InventoryListPageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className={cn(INVENTORY_CARD_SHELL, "p-5")}>
            <InventorySectionHeader
              icon={Package}
              title="Items"
              description="IMEI-tracked products need exact serials before sell-out."
            />
            <ul className="mt-4 space-y-4">
              {order.items.map((line) => {
                const v = variantLabel(line);
                const resolvedImg = imgSrc(linePrimaryImageUrl(line));
                const hasImei = line.storeProduct.product.hasImei;
                const opts = serialOptions[line.id] ?? [];
                const serialStrings = opts.map((o) => o.serial);
                const picked = selectedSerials[line.id] ?? [];
                const lineCancelled = Boolean(line.cancelled);

                return (
                  <li
                    key={line.id}
                    className={cn(
                      "rounded-xl border border-border/80 bg-muted/20 p-4",
                      lineCancelled && "border-dashed opacity-75",
                    )}
                  >
                    <div className="flex gap-4">
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background ring-1 ring-border">
                        {resolvedImg ? (
                          <Image
                            src={resolvedImg}
                            alt=""
                            fill
                            className="object-contain p-1"
                            sizes="80px"
                            unoptimized
                          />
                        ) : (
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "font-semibold leading-snug",
                              lineCancelled && "text-muted-foreground line-through decoration-muted-foreground/80",
                            )}
                          >
                            {line.storeProduct.product.name}
                          </p>
                          {lineCancelled && (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:text-red-400">
                              Cancelled
                            </span>
                          )}
                        </div>
                        {v && (
                          <p className="text-xs text-muted-foreground">{v}</p>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">
                          Qty {line.quantity} ·{" "}
                          {formatPrice(Number(line.unitPrice))} each
                        </p>
                        {hasImei && !lineCancelled && (
                          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
                            <Smartphone className="h-3.5 w-3.5" />
                            IMEI / serial — pick {line.quantity} unit(s)
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            lineCancelled && "text-muted-foreground line-through",
                          )}
                        >
                          {formatPrice(Number(line.total))}
                        </div>
                        {canCancel && !lineCancelled && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={cancellingLineId !== null}
                            onClick={() => handleCancelLine(line)}
                          >
                            {cancellingLineId === line.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Cancel"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {hasImei && canComplete && !lineCancelled && (
                      <div className="mt-4 border-t border-border/60 pt-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Select {line.quantity} IMEI / serial (searchable)
                        </p>
                        <OrderLineImeiCombobox
                          quantity={line.quantity}
                          serials={serialStrings}
                          selected={picked}
                          loading={!!serialLoading[line.id]}
                          disabled={!canComplete}
                          onChange={(next) =>
                            setImeiSelection(line.id, line.quantity, next)
                          }
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          Selected {picked.length} / {line.quantity}
                          {picked.length === line.quantity &&
                            new Set(picked).size !== picked.length && (
                              <span className="ml-2 text-destructive">
                                Duplicates not allowed
                              </span>
                            )}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={cn(INVENTORY_CARD_SHELL, "p-5")}>
            <h3 className="text-sm font-semibold text-muted-foreground">
              Status history
            </h3>
            <ul className="mt-3 space-y-3">
              {(order.tracking ?? []).map((t) => (
                <li
                  key={t.id}
                  className="flex gap-3 border-l-2 border-primary/30 pl-3 text-sm"
                >
                  <div>
                    <StatusBadge status={t.status} />
                    {t.note && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.note}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTimeMedShort(new Date(t.createdAt).toISOString())}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className={cn(INVENTORY_CARD_SHELL, "p-5")}>
            <h3 className="font-semibold">Customer & delivery</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="font-medium">{order.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="font-mono">{order.phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Address</dt>
                <dd>
                  {order.address}
                  <br />
                  {order.district}, {order.division}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Payment</dt>
                <dd className="uppercase">{order.paymentMethod}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-base font-bold">
              <span>Total</span>
              <span className="text-primary">
                {formatPrice(Number(order.totalAmount))}
              </span>
            </div>
          </div>

          {branchName != null && (
            <div className={cn(INVENTORY_CARD_SHELL, "p-5")}>
              <h3 className="font-semibold">Fulfillment branch</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Stock for this cart is reserved at{" "}
                <span className="font-medium text-foreground">{branchName}</span>
                . Sell-out must use this branch.
              </p>
            </div>
          )}

          {order.sale && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Converted to sale</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Invoice{" "}
                <span className="font-mono font-medium">
                  {order.sale.invoiceNumber}
                </span>
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href={`/sales/history/${order.sale.id}`}>Open sale</Link>
              </Button>
            </div>
          )}

          {canUpdateStatus && (
            <div className={cn(INVENTORY_CARD_SHELL, "p-5")}>
              <h3 className="font-semibold">Update status</h3>
              <div className="mt-3 space-y-3">
                <Select
                  value={nextStatus || undefined}
                  onValueChange={(v) => setNextStatus(v as OrderStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose next status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_NEXT.filter((s) => s !== order.status).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Note (optional)"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={!nextStatus || statusSaving}
                  onClick={handleStatusUpdate}
                >
                  {statusSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save status"
                  )}
                </Button>
              </div>
            </div>
          )}

          {canComplete && (
            <div className={cn(INVENTORY_CARD_SHELL, "p-5")}>
              <h3 className="font-semibold">Confirm sell-out</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Creates a completed sale, decrements stock, marks IMEIs sold.
              </p>
              <div className="mt-4">
                <label className="text-xs font-medium text-muted-foreground">
                  Payment account *
                </label>
                {accounts.length === 0 ? (
                  <p className="mt-1 text-sm text-destructive">
                    No active accounts. Add one under Finance → Accounts before selling.
                  </p>
                ) : (
                  <Select
                    value={paymentAccountId || undefined}
                    onValueChange={setPaymentAccountId}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={String(a.id)} value={String(a.id)}>
                          {a.accountName ?? a.name ?? String(a.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                className="mt-4 w-full gap-2"
                disabled={
                  !imeiValid ||
                  completeLoading ||
                  accounts.length === 0 ||
                  !paymentAccountId
                }
                onClick={handleComplete}
              >
                {completeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Complete & sell out
                  </>
                )}
              </Button>
            </div>
          )}

          {canCancel && (
            <Button
              variant="destructive"
              className="w-full gap-2"
              disabled={cancelLoading}
              onClick={handleCancel}
            >
              {cancelLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Cancel order
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

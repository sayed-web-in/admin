"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Trash2, Search, ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { extractApiList } from "@/lib/apiList";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import ImeiModal from "@/components/common/ImeiModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  company?: string;
  companyName?: string;
}

interface Branch {
  id: number;
  name: string;
}

interface AccountRow {
  id: number;
  name: string;
  type?: string;
  accountType?: string;
  balance?: number | string;
  isActive?: boolean;
}

interface StoreProductRow {
  id: number;
  productId: number;
  productVariantId?: number | null;
  product?: {
    name: string;
    hasImei?: boolean;
    sku?: string | null;
    type?: string;
  };
  variant?: {
    label?: string;
    sku?: string;
    attributes?: { attributeValue?: { value?: string } }[];
  };
  productVariant?: {
    sku?: string;
    attributes?: { attributeValue?: { value?: string } }[];
  };
  quantity: number;
  /** Quantity-weighted average acquisition cost from batches (not retail). */
  avgPurchaseUnitCost?: number;
  sellingPrice?: number;
}

interface PurchaseLineItem {
  uid: string;
  storeProductId: number;
  productName: string;
  variantLabel: string;
  sku: string;
  inStock: number;
  quantity: number;
  unitCost: number | "";
  hasImei: boolean;
  serials: string[];
  mfgExpiry: string;
}

interface PaymentRow {
  id: string;
  accountId: string;
  amount: number | "";
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Same as seller add-purchase: non-negative money fields, empty string while clearing. */
function parseSummaryMoneyInput(raw: string): number | "" {
  if (raw === "") return "";
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return "";
  return n;
}

function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function variantLabelFromSp(sp: StoreProductRow): string {
  const attrs =
    sp.productVariant?.attributes ?? sp.variant?.attributes ?? [];
  const parts = attrs
    .map((a) => a.attributeValue?.value)
    .filter((x): x is string => Boolean(x && String(x).trim()));
  if (parts.length) return parts.join(", ");
  if (sp.variant?.label) return sp.variant.label;
  return "—";
}

function skuFromSp(sp: StoreProductRow): string {
  return (
    sp.productVariant?.sku ??
    sp.variant?.sku ??
    sp.product?.sku ??
    "—"
  );
}

function accountTypeToPaymentMethod(t: string): string {
  const x = t.toLowerCase();
  if (x === "cash") return "cash";
  if (x === "bank") return "bank_transfer";
  if (x === "mobile_banking") return "mobile_banking";
  return "cash";
}

function adjustSerials(serials: string[], qty: number): string[] {
  const next = serials.slice(0, qty);
  while (next.length < qty) next.push("");
  return next;
}

/** Same idea as seller admin: variable products always pick a variant, even if only one SKU exists at this branch. */
function isVariableProductRows(rows: StoreProductRow[]): boolean {
  if (rows.length === 0) return false;
  if (rows.length > 1) return true;
  const row = rows[0];
  const t = row?.product?.type;
  if (t && String(t).toUpperCase() === "VARIABLE") return true;
  // If API omits `type`, a linked variant id usually means this listing is a variable SKU.
  if (row.productVariantId != null) return true;
  return false;
}

const fieldInputClass =
  "w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/** Match add-product category/brand combobox field shell */
const basicFieldClass =
  "border-border/90 bg-muted/55 dark:bg-muted/35 min-h-10 rounded-xl";

const sectionCardClass =
  "rounded-xl border border-border bg-card p-6 shadow-sm";

type CatalogComboOption = { value: number; label: string };

function catalogItemEqual(a: CatalogComboOption, b: CatalogComboOption) {
  return a.value === b.value;
}

export default function AddPurchasePage() {
  const router = useRouter();
  const supplierBoxRef = useRef<HTMLDivElement>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([
    { id: "1", accountId: "", amount: "" },
  ]);

  const [items, setItems] = useState<PurchaseLineItem[]>([]);
  const [branchStoreSkus, setBranchStoreSkus] = useState<StoreProductRow[]>([]);
  const [loadingSkus, setLoadingSkus] = useState(false);
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<
    number | null
  >(null);
  const [selectedVariantStoreId, setSelectedVariantStoreId] = useState("");

  const [purchaseDate, setPurchaseDate] = useState(todayISODate);
  const [discount, setDiscount] = useState<number | "">("");
  const [tax, setTax] = useState<number | "">("");
  const [shippingCost, setShippingCost] = useState<number | "">("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const [supplierAdvance, setSupplierAdvance] = useState(0);
  const [advanceApplied, setAdvanceApplied] = useState(0);

  const [showImeiModal, setShowImeiModal] = useState(false);
  const [currentItemForImei, setCurrentItemForImei] = useState<string | null>(
    null
  );

  const syncBranch = useCallback(() => {
    setBranchId(getSelectedBranch());
  }, []);

  useEffect(() => {
    syncBranch();
    const onBranch = () => syncBranch();
    window.addEventListener("branch-changed", onBranch);
    return () => window.removeEventListener("branch-changed", onBranch);
  }, [syncBranch]);

  useEffect(() => {
    apiFetch<Branch[] | { data?: Branch[] }>("/branches")
      .then((d) => {
        const list = Array.isArray(d) ? d : d.data ?? [];
        setBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch<unknown>("/suppliers?limit=500&isActive=true")
      .then((d) =>
        setSuppliers(extractApiList<Supplier>(d, ["suppliers"]))
      )
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    apiFetch<AccountRow[] | { data?: AccountRow[] }>("/finance/accounts")
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data || [];
        const rows = Array.isArray(list)
          ? list.filter((a) => a && (a.isActive ?? true))
          : [];
        setAccounts(rows);
      })
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    if (!supplierId) {
      setSupplierAdvance(0);
      setAdvanceApplied(0);
      return;
    }
    const sid = Number(supplierId);
    if (!Number.isFinite(sid)) {
      setSupplierAdvance(0);
      return;
    }
    apiFetch<{ advance?: number } | { data?: { advance?: number } }>(
      `/suppliers/${sid}/stats`
    )
      .then((res) => {
        const raw = res as { advance?: number; data?: { advance?: number } };
        const adv = raw.advance ?? raw.data?.advance;
        setSupplierAdvance(typeof adv === "number" ? adv : 0);
      })
      .catch(() => setSupplierAdvance(0));
  }, [supplierId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(t)) {
        setSupplierOpen(false);
      }
    };
    if (supplierOpen) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [supplierOpen]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      const co = s.companyName ?? s.company;
      return (
        s.name.toLowerCase().includes(q) ||
        (co && co.toLowerCase().includes(q))
      );
    });
  }, [suppliers, supplierSearch]);

  useEffect(() => {
    setBranchStoreSkus([]);
    setSelectedCatalogProductId(null);
    setSelectedVariantStoreId("");
    if (branchId == null) return;

    let cancelled = false;
    setLoadingSkus(true);
    const params = new URLSearchParams({
      branchId: String(branchId),
      limit: "500",
      isActive: "true",
    });
    apiFetch<{ data?: StoreProductRow[] } | StoreProductRow[]>(
      `/products/store?${params}`
    )
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res.data || [];
        setBranchStoreSkus(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) {
          setBranchStoreSkus([]);
          toast.error("Could not load products for this branch.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSkus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const catalogProductOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const sp of branchStoreSkus) {
      if (!m.has(sp.productId)) {
        m.set(sp.productId, sp.product?.name ?? "Product");
      }
    }
    return Array.from(m.entries()).map(([productId, name]) => ({
      productId,
      name,
    }));
  }, [branchStoreSkus]);

  const catalogComboItems = useMemo<CatalogComboOption[]>(
    () =>
      catalogProductOptions.map((p) => ({
        value: p.productId,
        label: p.name,
      })),
    [catalogProductOptions]
  );

  const selectedCatalogCombo = useMemo(
    () =>
      selectedCatalogProductId == null
        ? null
        : (catalogComboItems.find((x) => x.value === selectedCatalogProductId) ??
          null),
    [catalogComboItems, selectedCatalogProductId]
  );

  const rowsForSelectedCatalog = useMemo(() => {
    if (selectedCatalogProductId == null) return [];
    return branchStoreSkus.filter(
      (sp) => sp.productId === selectedCatalogProductId
    );
  }, [branchStoreSkus, selectedCatalogProductId]);

  const addProduct = (sp: StoreProductRow) => {
    const hasImei = Boolean(sp.product?.hasImei);
    const exists = items.find((i) => i.storeProductId === sp.id);
    if (exists) {
      setItems((prev) =>
        prev.map((i) => {
          if (i.storeProductId !== sp.id) return i;
          const q = i.quantity + 1;
          return {
            ...i,
            quantity: q,
            serials: hasImei ? adjustSerials(i.serials, q) : [],
          };
        })
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          uid: `${sp.id}-${Date.now()}`,
          storeProductId: sp.id,
          productName: sp.product?.name || "Product",
          variantLabel: variantLabelFromSp(sp),
          sku: skuFromSp(sp),
          inStock: sp.quantity,
          quantity: 1,
          unitCost: "",
          hasImei,
          serials: hasImei ? [""] : [],
          mfgExpiry: "",
        },
      ]);
    }
    setSelectedCatalogProductId(null);
    setSelectedVariantStoreId("");
  };

  const pickCatalogProduct = (productId: number) => {
    const rows = branchStoreSkus.filter((sp) => sp.productId === productId);
    if (rows.length === 0) return;
    if (!isVariableProductRows(rows)) {
      addProduct(rows[0]);
      return;
    }
    setSelectedCatalogProductId(productId);
    setSelectedVariantStoreId("");
  };

  const handleQuantityDelta = (uid: string, delta: 1 | -1) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== uid) return i;
        const q = Math.max(1, i.quantity + delta);
        return {
          ...i,
          quantity: q,
          serials: i.hasImei ? adjustSerials(i.serials, q) : i.serials,
        };
      })
    );
  };

  const updateItem = (
    uid: string,
    field: "quantity" | "unitCost" | "mfgExpiry",
    value: number | string
  ) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== uid) return i;
        if (field === "mfgExpiry") {
          return { ...i, mfgExpiry: String(value) };
        }
        if (field === "quantity") {
          const q = Math.max(1, Number(value));
          return {
            ...i,
            quantity: q,
            serials: i.hasImei ? adjustSerials(i.serials, q) : i.serials,
          };
        }
        if (value === "") {
          return { ...i, unitCost: "" };
        }
        const n = Number(value);
        if (!Number.isFinite(n)) return i;
        return { ...i, unitCost: Math.max(0, n) };
      })
    );
  };

  const openImeiModal = (itemUid: string) => {
    setCurrentItemForImei(itemUid);
    setShowImeiModal(true);
  };

  const closeImeiModal = () => {
    setShowImeiModal(false);
    setCurrentItemForImei(null);
  };

  const handleUpdateItemImeis = (itemUid: string, serials: string[]) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== itemUid || !i.hasImei) return i;
        return { ...i, serials: adjustSerials(serials, i.quantity) };
      })
    );
  };

  const getCurrentItemForImei = () =>
    items.find((i) => i.uid === currentItemForImei) ?? null;

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const discountVal = typeof discount === "number" ? discount : 0;
  const taxVal = typeof tax === "number" ? tax : 0;
  const shipVal = typeof shippingCost === "number" ? shippingCost : 0;

  const subtotal = useMemo(
    () =>
      r2(
        items.reduce(
          (s, i) =>
            s +
            i.quantity *
              (typeof i.unitCost === "number" ? i.unitCost : 0),
          0
        )
      ),
    [items]
  );
  const grandTotal = useMemo(
    () => r2(subtotal + taxVal + shipVal - discountVal),
    [subtotal, taxVal, shipVal, discountVal]
  );

  const grandTotalRef = useRef(grandTotal);
  grandTotalRef.current = grandTotal;

  const paymentTotal = useMemo(
    () =>
      r2(
        payments.reduce(
          (s, p) => s + (typeof p.amount === "number" ? p.amount : 0),
          0
        )
      ),
    [payments]
  );

  const maxAdvance = useMemo(
    () =>
      r2(Math.min(supplierAdvance, Math.max(0, grandTotal - paymentTotal))),
    [supplierAdvance, grandTotal, paymentTotal]
  );

  const advanceToApply = useMemo(
    () => r2(Math.min(advanceApplied, maxAdvance)),
    [advanceApplied, maxAdvance]
  );

  const advanceToApplyRef = useRef(advanceToApply);
  advanceToApplyRef.current = advanceToApply;

  useEffect(() => {
    const max = r2(
      Math.min(supplierAdvance, Math.max(0, grandTotal - paymentTotal))
    );
    setAdvanceApplied((prev) => (prev > max ? max : prev));
  }, [supplierAdvance, grandTotal, paymentTotal]);

  const totalPaid = useMemo(
    () => r2(paymentTotal + advanceToApply),
    [paymentTotal, advanceToApply]
  );
  const dueAmount = useMemo(
    () => r2(grandTotal - totalPaid),
    [grandTotal, totalPaid]
  );

  const paymentStatus =
    dueAmount <= 0 ? "paid" : totalPaid > 0 ? "partial" : "due";

  const handleAddPayment = () => {
    setPayments((prev) => [
      ...prev,
      { id: `${Date.now()}`, accountId: "", amount: "" },
    ]);
  };

  const handleRemovePayment = (id: string) => {
    setPayments((prev) =>
      prev.length > 1 ? prev.filter((p) => p.id !== id) : prev
    );
  };

  const handlePaymentChange = (
    id: string,
    field: "accountId" | "amount",
    value: string | number | ""
  ) => {
    const gt = grandTotalRef.current;
    const adv = advanceToApplyRef.current;
    setPayments((prev) =>
      prev.map((payment) => {
        if (payment.id !== id) return payment;
        if (field === "accountId") {
          const nextId = String(value);
          return {
            ...payment,
            accountId: nextId,
            ...(nextId === "" ? { amount: "" as const } : {}),
          };
        }
        if (field === "amount") {
          if (value === "") return { ...payment, amount: "" };
          const newAmount =
            typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(newAmount)) return { ...payment, amount: "" };
          const otherTotal = prev
            .filter((p) => p.id !== id)
            .reduce(
              (sum, p) =>
                sum + (typeof p.amount === "number" ? p.amount : 0),
              0
            );
          const maxByGrandTotal = gt - adv - otherTotal;
          const acc = accounts.find(
            (a) => String(a.id) === payment.accountId
          );
          const accountBalance = acc
            ? Number(acc.balance ?? 0)
            : Number.POSITIVE_INFINITY;
          const maxAllowed = Math.min(
            Math.max(0, maxByGrandTotal),
            accountBalance >= 0 ? accountBalance : 0
          );
          const clamped = Math.min(Math.max(0, newAmount), maxAllowed);
          return { ...payment, amount: clamped };
        }
        return payment;
      })
    );
  };

  const selectClasses =
    "min-h-[42px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const buildNote = (): string | undefined => {
    const parts: string[] = [];
    if (purchaseDate.trim()) parts.push(`Purchase date: ${purchaseDate.trim()}`);
    const inv = invoiceNo.trim();
    const ref = reference.trim();
    if (inv) parts.push(`Invoice: ${inv}`);
    if (ref) parts.push(`Reference: ${ref}`);
    const mfgLines = items
      .filter((i) => i.mfgExpiry.trim())
      .map((i) => `${i.productName}: Mfg/Expiry ${i.mfgExpiry.trim()}`);
    if (mfgLines.length) parts.push(mfgLines.join("\n"));
    const full = parts.join("\n").trim();
    return full || undefined;
  };

  const handleSubmit = async () => {
    if (branchId == null) {
      toast.error("Select a branch from the header.");
      return;
    }
    if (!supplierId) {
      toast.error("Select a supplier.");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one product.");
      return;
    }

    const bad = items.find(
      (i) =>
        i.quantity < 1 ||
        typeof i.unitCost !== "number" ||
        !Number.isFinite(i.unitCost) ||
        i.unitCost <= 0
    );
    if (bad) {
      toast.error("Each line needs a valid quantity and unit cost.");
      return;
    }

    for (const i of items) {
      if (!i.hasImei) continue;
      const filled = i.serials.map((s) => s.trim()).filter(Boolean);
      if (filled.length !== i.quantity) {
        toast.error(
          `"${i.productName}": enter ${i.quantity} serial/IMEI value(s) (${filled.length} filled).`
        );
        return;
      }
      const uniq = new Set(filled);
      if (uniq.size !== filled.length) {
        toast.error(`"${i.productName}": serial numbers must be unique.`);
        return;
      }
    }

    if (totalPaid > grandTotal + 0.001) {
      toast.error("Total paid cannot exceed grand total.");
      return;
    }

    const paymentRowsPayload = payments
      .filter(
        (p) =>
          p.accountId &&
          p.amount !== "" &&
          typeof p.amount === "number" &&
          p.amount > 0
      )
      .map((p) => ({
        accountId: Number(p.accountId),
        amount: p.amount as number,
      }));

    for (const p of payments) {
      const amt = typeof p.amount === "number" ? p.amount : 0;
      if (amt <= 0) continue;
      if (!p.accountId) {
        toast.error("Each payment with an amount needs an account.");
        return;
      }
      const acc = accounts.find((a) => String(a.id) === p.accountId);
      if (acc != null && amt > Number(acc.balance ?? 0) + 0.001) {
        toast.error(`Amount exceeds balance for "${acc.name}".`);
        return;
      }
    }

    let method = "cash";
    if (paymentRowsPayload.length > 0) {
      const acc = accounts.find(
        (a) => a.id === paymentRowsPayload[0].accountId
      );
      if (acc) {
        method = accountTypeToPaymentMethod(
          String(acc.type ?? acc.accountType ?? "cash")
        );
      }
    } else if (advanceToApply > 0) {
      method = "advance";
    }

    if (advanceToApply > supplierAdvance + 0.001) {
      toast.error("Advance applied cannot exceed supplier advance balance.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId: Number(supplierId),
          branchId,
          items: items.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.quantity,
            unitCost: i.unitCost as number,
            serialNumbers:
              i.hasImei && i.serials.some((s) => s.trim())
                ? i.serials.map((s) => s.trim()).filter(Boolean)
                : undefined,
          })),
          discount: discountVal,
          tax: taxVal,
          shippingCost: shipVal,
          paymentMethod: method,
          paidAmount: paymentTotal,
          advanceApplied:
            advanceToApply > 0 ? advanceToApply : undefined,
          payments:
            paymentRowsPayload.length > 0 ? paymentRowsPayload : undefined,
          note: buildNote(),
        }),
      });
      toast.success("Purchase created successfully.");
      router.push("/purchases");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const statusBadgeClass =
    paymentStatus === "paid"
      ? "bg-green-500/20 text-green-600 dark:text-green-400"
      : paymentStatus === "partial"
        ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
        : "bg-red-500/20 text-red-600 dark:text-red-400";

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Add Purchase"
        description="Create a new purchase order"
        action={
          <Link href="/purchases">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </Link>
        }
      />

      <form
        className="space-y-6"
        style={{ overflow: "visible", position: "relative" }}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        {/* Purchase Details */}
        <div
          className={sectionCardClass}
          style={{
            overflow: "visible",
            position: "relative",
            zIndex: supplierOpen ? 10 : 1,
          }}
        >
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Purchase Details
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Store <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId != null ? String(branchId) : ""}
                disabled
                className={cnSelectDisabled()}
              >
                <option value="" disabled>
                  Select store
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Change store from the header branch selector.
              </p>
            </div>

            <div ref={supplierBoxRef} className="relative">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Supplier <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setSupplierOpen(true);
                  }}
                  onFocus={() => setSupplierOpen(true)}
                  placeholder="Search or select supplier..."
                  className={`${fieldInputClass} pl-10 pr-10`}
                  required={!supplierId}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setSupplierOpen((o) => !o)}
                  aria-label="Toggle supplier list"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              {supplierOpen && (
                <div
                  className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover shadow-xl"
                >
                  {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map((s) => (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSupplierId(String(s.id));
                          setSupplierSearch(
                            (s.companyName ?? s.company)
                              ? `${s.name} (${s.companyName ?? s.company})`
                              : s.name
                          );
                          setSupplierOpen(false);
                        }}
                        className={`cursor-pointer px-4 py-2 text-sm transition-colors hover:bg-accent ${
                          String(s.id) === supplierId ? "bg-accent" : ""
                        }`}
                      >
                        {s.name}
                        {(s.companyName ?? s.company) &&
                          ` (${s.companyName ?? s.company})`}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-sm text-muted-foreground">
                      {suppliers.length === 0
                        ? "No suppliers available"
                        : "No suppliers found"}
                    </div>
                  )}
                </div>
              )}
              {supplierId ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-red-500 hover:text-red-600"
                  onClick={() => {
                    setSupplierId("");
                    setSupplierSearch("");
                  }}
                >
                  Clear selection
                </button>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className={fieldInputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Invoice No{" "}
                <span className="font-normal text-muted-foreground/80">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Supplier invoice / memo no."
                className={fieldInputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Enter reference"
                className={fieldInputClass}
              />
            </div>
          </div>
        </div>

        {/* Select Products — add-product style combobox + variant select for variable SKUs */}
        <div
          className={sectionCardClass}
          style={{
            overflow: "visible",
            position: "relative",
            zIndex: selectedCatalogProductId != null ? 10 : 1,
          }}
        >
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Select Products
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Product
              </label>
              <Combobox
                items={catalogComboItems}
                value={selectedCatalogCombo}
                onValueChange={(item) => {
                  if (!item) {
                    setSelectedCatalogProductId(null);
                    setSelectedVariantStoreId("");
                    return;
                  }
                  pickCatalogProduct(item.value);
                }}
                isItemEqualToValue={catalogItemEqual}
              >
                <ComboboxInput
                  className={basicFieldClass}
                  placeholder={
                    branchId
                      ? "Search or select product…"
                      : "Select a branch in the header first"
                  }
                  showClear={selectedCatalogProductId != null}
                  disabled={branchId == null || loadingSkus}
                />
                <ComboboxContent sideOffset={4} className="z-[120]">
                  <ComboboxEmpty>
                    {loadingSkus
                      ? "Loading…"
                      : branchId == null
                        ? "Select a branch first."
                        : branchStoreSkus.length === 0
                          ? "No products in this branch. Add store listings from Inventory."
                          : "No products found."}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {catalogComboItems.map((item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {loadingSkus && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Loading branch products…
                </p>
              )}
            </div>

            {selectedCatalogProductId != null &&
              rowsForSelectedCatalog.length > 0 &&
              isVariableProductRows(rowsForSelectedCatalog) && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">
                    Variant
                  </label>
                  <select
                    value={selectedVariantStoreId}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setSelectedVariantStoreId("");
                        return;
                      }
                      setSelectedVariantStoreId(id);
                      const sp = branchStoreSkus.find(
                        (s) => String(s.id) === id
                      );
                      if (sp) addProduct(sp);
                    }}
                    className={selectClasses}
                  >
                    <option value="">
                      Select variant
                    </option>
                    {rowsForSelectedCatalog.map((sp) => {
                      const label = variantLabelFromSp(sp);
                      const already = items.some(
                        (i) => i.storeProductId === sp.id
                      );
                      return (
                        <option
                          key={sp.id}
                          value={String(sp.id)}
                          disabled={already}
                        >
                          {label}
                          {already ? " — Already added" : ` — Stock ${sp.quantity}`}
                          {sp.product?.hasImei ? " (IMEI)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
          </div>
        </div>

        {/* Purchase Items */}
        {items.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold text-foreground">
                Purchase Items
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b-2 border-primary/20 bg-muted/60">
                  <tr>
                    {[
                      "Product",
                      "SKU",
                      "In Stock",
                      "Purchase Qty",
                      "Unit Cost",
                      "Total Cost",
                      "Serial/IMEI No.",
                      "Mfg/Expiry",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.uid}
                      className="border-b border-border transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {item.productName}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {item.inStock}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuantityDelta(item.uid, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded bg-muted text-sm font-medium hover:bg-muted/80"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(
                                item.uid,
                                "quantity",
                                Number(e.target.value)
                              )
                            }
                            className="w-16 rounded border border-input bg-background px-2 py-1 text-center text-sm [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityDelta(item.uid, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded bg-muted text-sm font-medium hover:bg-muted/80"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitCost === "" ? "" : item.unitCost}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              updateItem(item.uid, "unitCost", "");
                              return;
                            }
                            const n = Number(raw);
                            if (!Number.isFinite(n)) return;
                            updateItem(item.uid, "unitCost", n);
                          }}
                          placeholder="0.00"
                          className="w-24 rounded border border-input bg-background px-2 py-1 text-sm [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {formatPrice(
                          item.quantity *
                            (typeof item.unitCost === "number"
                              ? item.unitCost
                              : 0)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.hasImei ? (
                          <button
                            type="button"
                            onClick={() => openImeiModal(item.uid)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                          >
                            <Plus className="size-3" />
                            Add ({item.serials.filter((s) => s.trim()).length}/
                            {item.quantity})
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.mfgExpiry}
                          onChange={(e) =>
                            updateItem(item.uid, "mfgExpiry", e.target.value)
                          }
                          placeholder="Mfg/Expiry"
                          className="w-32 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(item.uid)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
                          aria-label="Remove line"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment & Summary */}
        <div
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div className={sectionCardClass}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                Payment Details
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={handleAddPayment}
              >
                <Plus className="size-4" />
                Add More Payment
              </Button>
            </div>
            <div className="space-y-4 border-b border-border pb-4">
              {payments.map((payment, index) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-3 border-b border-border/80 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-end"
                >
                  <div className="min-w-0 flex-1">
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Account {index + 1}
                    </label>
                    <select
                      value={payment.accountId}
                      onChange={(e) =>
                        handlePaymentChange(
                          payment.id,
                          "accountId",
                          e.target.value
                        )
                      }
                      className={selectClasses}
                    >
                      <option value="">Select account (optional)</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {a.name} — {formatPrice(Number(a.balance ?? 0))}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={payment.amount === "" ? "" : payment.amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePaymentChange(
                          payment.id,
                          "amount",
                          v === "" ? "" : Number(v)
                        );
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder={
                        payment.accountId ? "0.00" : "Select account first"
                      }
                      disabled={!payment.accountId}
                      className={`${fieldInputClass} disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    />
                  </div>
                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(payment.id)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      aria-label="Remove payment row"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {supplierId && supplierAdvance > 0 && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 dark:bg-emerald-950/20">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Supplier advance
                  </span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    Available: {formatPrice(supplierAdvance)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-emerald-600/50 text-xs text-emerald-800 dark:text-emerald-300"
                    onClick={() => setAdvanceApplied(maxAdvance)}
                  >
                    Use full advance
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-emerald-600/40 text-xs text-emerald-800 dark:text-emerald-300"
                    onClick={() => setAdvanceApplied(0)}
                  >
                    Clear
                  </Button>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Custom amount"
                    value={advanceApplied || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        setAdvanceApplied(0);
                        return;
                      }
                      const num = parseFloat(v.replace(/,/g, "."));
                      if (Number.isNaN(num) || num < 0) return;
                      setAdvanceApplied(Math.min(num, maxAdvance));
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-sm text-foreground [appearance:textfield] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className={sectionCardClass}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount === "" ? "" : discount}
                  onChange={(e) =>
                    setDiscount(parseSummaryMoneyInput(e.target.value))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className="w-32 rounded border border-input bg-background px-3 py-1 text-right text-sm [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tax === "" ? "" : tax}
                  onChange={(e) =>
                    setTax(parseSummaryMoneyInput(e.target.value))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className="w-32 rounded border border-input bg-background px-3 py-1 text-right text-sm [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shipping:</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={shippingCost === "" ? "" : shippingCost}
                  onChange={(e) =>
                    setShippingCost(parseSummaryMoneyInput(e.target.value))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className="w-32 rounded border border-input bg-background px-3 py-1 text-right text-sm [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="flex justify-between text-lg font-semibold text-foreground">
                  <span>Grand Total:</span>
                  <span className="text-primary">{formatPrice(grandTotal)}</span>
                </div>
                {advanceToApply > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Advance applied:</span>
                    <span className="font-medium">
                      {formatPrice(advanceToApply)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Total Paid:</span>
                  <span className="font-medium">{formatPrice(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                  <span>Due Amount:</span>
                  <span className="font-medium">{formatPrice(dueAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass}`}
                  >
                    {paymentStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create Purchase"}
          </Button>
        </div>
      </form>

      {currentItemForImei && (
        <ImeiModal
          isOpen={showImeiModal}
          onClose={closeImeiModal}
          quantity={getCurrentItemForImei()?.quantity ?? 0}
          currentSerials={
            getCurrentItemForImei()?.serials.map((s) => s.trim()).filter(Boolean) ??
            []
          }
          onConfirm={(serials) => {
            if (currentItemForImei) {
              handleUpdateItemImeis(currentItemForImei, serials);
            }
          }}
          title={`Serial/IMEI — ${getCurrentItemForImei()?.productName ?? ""}`}
          placeholder="Scan or type IMEI…"
        />
      )}
    </div>
  );
}

function cnSelectDisabled(): string {
  return [
    "w-full cursor-not-allowed rounded-lg border border-input bg-muted/50 px-4 py-2 text-sm opacity-80",
    "focus:outline-none",
  ].join(" ");
}

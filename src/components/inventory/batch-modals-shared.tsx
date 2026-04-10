"use client";

import type { ReactNode } from "react";

export function formatBatchType(type: string): string {
  const t = (type || "").toLowerCase().replace(/-/g, "_");
  const types: Record<string, string> = {
    initial: "Initial",
    purchase: "Purchase",
    transfer_in: "Transfer In",
    adjustment: "Adjustment",
  };
  return types[t] || type || "—";
}

export interface BatchListRow {
  id: number;
  batchNumber: string;
  barcode: string;
  availableQty: number;
  soldQty: number;
  returnQty: number;
  purchaseCost: number;
  serialCount: number;
  batchDate: string;
  batchType: string;
}

export interface BatchDetailNormalized {
  id: number;
  batchNumber: string;
  barcode: string;
  type: string;
  initialQty: number;
  availableQty: number;
  soldQty: number;
  returnQty: number;
  purchaseCost: number;
  totalCost: number;
  batchDate: string;
  supplier?: { name: string; phone?: string; email?: string };
  serialNumbers: {
    id: number;
    serial: string;
    status: string;
    createdAt: string;
  }[];
}

export function mapListBatches(raw: Record<string, unknown>[]): BatchListRow[] {
  return raw.map((b) => ({
    id: Number(b.id),
    batchNumber: String(b.batchNumber ?? ""),
    barcode: String(b.barcode ?? ""),
    availableQty: Number(b.availableQty ?? 0),
    soldQty: Number(b.soldQty ?? 0),
    returnQty: Number(b.returnQty ?? 0),
    purchaseCost: Number(b.purchaseCost ?? 0),
    serialCount: Array.isArray(b.serialNumbers)
      ? (b.serialNumbers as unknown[]).length
      : 0,
    batchDate: String(
      (b.batchDate as string) || (b.createdAt as string) || ""
    ),
    batchType: String(b.batchType ?? b.type ?? "initial"),
  }));
}

export function normalizeDetailBatch(
  batch: Record<string, unknown>
): BatchDetailNormalized {
  const serialsRaw = batch.serialNumbers;
  const serialNumbers = Array.isArray(serialsRaw)
    ? (serialsRaw as Record<string, unknown>[]).map((s, i) => ({
        id: typeof s.id === "number" ? s.id : i,
        serial: String(s.serial ?? ""),
        status: String(s.status ?? "IN_STOCK"),
        createdAt: String(s.createdAt ?? ""),
      }))
    : [];

  return {
    id: Number(batch.id ?? 0),
    batchNumber: String(batch.batchNumber ?? ""),
    barcode: String(batch.barcode ?? ""),
    type: String(batch.type ?? ""),
    initialQty: Number(batch.initialQty ?? 0),
    availableQty: Number(batch.availableQty ?? 0),
    soldQty: Number(batch.soldQty ?? 0),
    returnQty: Number(batch.returnQty ?? 0),
    purchaseCost: Number(batch.purchaseCost ?? 0),
    totalCost: Number(batch.totalCost ?? 0),
    batchDate: String(batch.batchDate ?? ""),
    supplier: batch.supplier
      ? {
          name: String((batch.supplier as Record<string, unknown>).name ?? ""),
          phone: (batch.supplier as Record<string, unknown>).phone
            ? String((batch.supplier as Record<string, unknown>).phone)
            : undefined,
          email: (batch.supplier as Record<string, unknown>).email
            ? String((batch.supplier as Record<string, unknown>).email)
            : undefined,
        }
      : undefined,
    serialNumbers,
  };
}

export function serialStatusLabel(status: string): string {
  const u = status.toUpperCase();
  if (u === "IN_STOCK") return "in_stock";
  if (u === "SOLD") return "sold";
  if (u === "RETURNED") return "returned";
  return status.toLowerCase() || "in_stock";
}

export function serialStatusBadgeVariant(
  status: string
): "success" | "secondary" | "destructive" {
  const u = status.toUpperCase();
  if (u === "IN_STOCK") return "success";
  if (u === "SOLD") return "destructive";
  return "secondary";
}

export const fieldCardClass =
  "rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-start gap-3";
export const labelClass = "text-xs text-muted-foreground leading-tight";
export const valueClass = "text-sm font-medium text-foreground mt-0.5 leading-tight";

export function FieldCard({
  label,
  value,
  valueHighlight,
  icon,
}: {
  label: string;
  value: ReactNode;
  valueHighlight?: "emerald" | "primary";
  icon?: ReactNode;
}) {
  const valueCn =
    valueHighlight === "emerald"
      ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 leading-tight"
      : valueHighlight === "primary"
        ? "text-sm font-semibold text-primary mt-0.5 leading-tight"
        : valueClass;
  return (
    <div className={fieldCardClass}>
      {icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-sm">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={labelClass}>{label}</p>
        <div className={valueCn}>{value}</div>
      </div>
    </div>
  );
}

export function batchStatusLabel(d: BatchDetailNormalized): string {
  return d.availableQty > 0 ? "Active" : "Out of stock";
}

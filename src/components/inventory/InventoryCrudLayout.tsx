"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export const INVENTORY_CARD_SHELL =
  "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]";

export const inventoryCheckboxClass =
  "size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring";

export function InventoryListPageHeader({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.08] sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/[0.12] blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 sm:h-14 sm:w-14">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {children ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function InventorySectionHeader({
  icon: Icon,
  title,
  description,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex min-w-0 flex-1 items-start gap-3"
          : "mb-5 flex items-start gap-3 border-b border-border/50 pb-4"
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 pt-0.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function InventoryStatusSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-sm text-muted-foreground">
        {checked ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

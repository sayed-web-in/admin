"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Use on Lucide icons inside row actions for consistent size. */
export const tableActionIconClassName = "h-3.5 w-3.5 shrink-0 stroke-[1.85]";

const shell =
  "inline-flex items-center gap-0.5 rounded-xl border border-border/70 bg-muted/30 p-0.5 shadow-sm ring-1 ring-black/[0.04] backdrop-blur-[2px] dark:border-border/50 dark:bg-muted/20 dark:ring-white/[0.06]";

const hit =
  "inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-background hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.97]";

const dangerHit =
  "text-muted-foreground hover:bg-destructive/12 hover:text-destructive hover:shadow-none";

export function TableRowActions({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Row actions"
      className={cn(shell, className)}
    >
      {children}
    </div>
  );
}

export function TableRowActionLink({
  className,
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cn(hit, className)}>
      {children}
    </Link>
  );
}

export function TableRowActionButton({
  className,
  variant = "default",
  ...props
}: ComponentProps<"button"> & { variant?: "default" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(hit, variant === "danger" && dangerHit, className)}
    />
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function TableLoading({
  columnCount,
  rowCount = 10,
  inventoryStyle,
  className,
  /** Match DataTable: pin & right-align the actions column while loading. */
  stickyActionsColumnIndex,
}: {
  columnCount: number;
  rowCount?: number;
  inventoryStyle?: boolean;
  className?: string;
  stickyActionsColumnIndex?: number;
}) {
  const shell = inventoryStyle
    ? "overflow-hidden rounded-xl border border-border/80 bg-muted/[0.12] ring-1 ring-black/[0.03] dark:bg-muted/10 dark:ring-white/[0.06]"
    : "overflow-hidden rounded-xl border border-border bg-card";

  const theadClass = inventoryStyle
    ? "bg-gradient-to-b from-muted/85 via-muted/70 to-muted/50 dark:from-muted/45 dark:via-muted/35 dark:to-muted/25"
    : "bg-muted/50";

  const thSticky =
    "sticky right-0 z-20 w-px min-w-[7.5rem] text-right align-middle border-l border-border/50 bg-gradient-to-b from-muted/85 via-muted/70 to-muted/50 shadow-[-10px_0_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur-[2px] dark:from-muted/45 dark:via-muted/35 dark:to-muted/25 dark:shadow-[-10px_0_24px_-8px_rgba(0,0,0,0.35)]";
  const thStickyPlain =
    "sticky right-0 z-20 w-px min-w-[7.5rem] text-right align-middle border-l border-border bg-muted/50 shadow-[-10px_0_20px_-8px_rgba(0,0,0,0.08)]";

  const tdStickyInv =
    "sticky right-0 z-10 w-px min-w-[7.5rem] text-right align-middle border-l border-border/50 bg-background/95 shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.1)] backdrop-blur-[2px] dark:bg-background/90";
  const tdStickyPlain =
    "sticky right-0 z-10 w-px min-w-[7.5rem] text-right align-middle border-l border-border bg-card shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.08)]";

  return (
    <div
      className={cn(shell, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="overflow-x-auto">
        <table
          className={cn("w-full", inventoryStyle && "border-collapse text-sm")}
        >
          <thead className={theadClass}>
            <tr className="border-b border-border/80">
              {Array.from({ length: columnCount }).map((_, i) => {
                const sticky =
                  stickyActionsColumnIndex != null &&
                  i === stickyActionsColumnIndex;
                return (
                  <th
                    key={i}
                    className={cn(
                      "px-3 py-3 text-left sm:px-4",
                      sticky &&
                        (inventoryStyle ? thSticky : thStickyPlain)
                    )}
                  >
                    <div
                      className={cn(
                        "h-3 rounded-md bg-foreground/[0.08] motion-safe:animate-pulse dark:bg-white/[0.08]",
                        sticky ? "ml-auto max-w-[4rem]" : "max-w-[5.5rem]"
                      )}
                      style={{ animationDelay: `${i * 55}ms` }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            className={cn(
              inventoryStyle && "divide-y divide-border/70 bg-muted/[0.06]"
            )}
          >
            {Array.from({ length: rowCount }).map((_, ri) => (
              <tr
                key={ri}
                className={cn(
                  "border-b border-border/50",
                  inventoryStyle &&
                    (ri % 2 === 0
                      ? "bg-background/95"
                      : "bg-muted/12 dark:bg-muted/15")
                )}
              >
                {Array.from({ length: columnCount }).map((_, ci) => {
                  const sticky =
                    stickyActionsColumnIndex != null &&
                    ci === stickyActionsColumnIndex;
                  return (
                    <td
                      key={ci}
                      className={cn(
                        "px-3 py-3 sm:px-4",
                        sticky &&
                          (inventoryStyle ? tdStickyInv : tdStickyPlain)
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 rounded-md bg-foreground/[0.06] motion-safe:animate-pulse dark:bg-white/[0.06]",
                          sticky && "ml-auto w-16"
                        )}
                        style={
                          sticky
                            ? {
                                animationDelay: `${(ri * columnCount + ci) * 35}ms`,
                              }
                            : {
                                width: `${42 + ((ri * 2 + ci * 3) % 38)}%`,
                                animationDelay: `${(ri * columnCount + ci) * 35}ms`,
                              }
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border/60 bg-muted/[0.06] py-3.5 text-sm text-muted-foreground dark:bg-muted/10">
        <Loader2
          className="size-4 shrink-0 animate-spin text-foreground/60"
          aria-hidden
        />
        <span>Loading data…</span>
      </div>
    </div>
  );
}

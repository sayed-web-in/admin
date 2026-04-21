"use client";
import { cn } from "@/lib/utils";
import { TableLoading } from "@/components/common/TableLoading";

interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

function isActionsColumn<T>(col: Column<T>) {
  return col.key === "actions";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  /** Matches inventory add-product inner table chrome (card, borders, typography). */
  inventoryStyle?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  inventoryStyle,
}: DataTableProps<T>) {
  const shell = inventoryStyle
    ? "overflow-hidden rounded-xl border border-border/80 bg-muted/[0.12] ring-1 ring-black/[0.03] dark:bg-muted/10 dark:ring-white/[0.06]"
    : "bg-white rounded-xl border border-border overflow-hidden";

  const actionsColumnIndex = columns.findIndex(isActionsColumn);

  if (loading) {
    return (
      <TableLoading
        columnCount={columns.length}
        inventoryStyle={inventoryStyle}
        stickyActionsColumnIndex={
          actionsColumnIndex >= 0 ? actionsColumnIndex : undefined
        }
      />
    );
  }

  const thClass = inventoryStyle
    ? "px-3 py-3 text-left align-middle text-[0.68rem] font-semibold uppercase tracking-wider text-foreground/65 dark:text-foreground/55"
    : "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider";

  const tdClass = inventoryStyle ? "px-3 py-2.5 text-sm" : "px-4 py-3 text-sm";

  const emptyPadding = inventoryStyle ? "px-3 py-12" : "px-4 py-8";

  const actionsThExtra = inventoryStyle
    ? "sticky right-0 z-20 w-px min-w-[7.5rem] text-right align-middle whitespace-nowrap border-l border-border/50 bg-gradient-to-b from-muted/85 via-muted/70 to-muted/50 shadow-[-10px_0_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur-[2px] dark:from-muted/45 dark:via-muted/35 dark:to-muted/25 dark:shadow-[-10px_0_24px_-8px_rgba(0,0,0,0.35)]"
    : "sticky right-0 z-20 w-px min-w-[7.5rem] text-right align-middle whitespace-nowrap border-l border-border bg-muted/50 shadow-[-10px_0_20px_-8px_rgba(0,0,0,0.08)]";

  const actionsTdExtra = inventoryStyle
    ? "sticky right-0 z-10 w-px min-w-[7.5rem] text-right align-middle whitespace-nowrap border-l border-border/50 bg-background/95 shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.1)] backdrop-blur-[2px] transition-colors group-hover/row:bg-muted/45 dark:bg-background/90 dark:shadow-[-8px_0_20px_-8px_rgba(0,0,0,0.35)] dark:group-hover/row:bg-muted/35"
    : "sticky right-0 z-10 w-px min-w-[7.5rem] text-right align-middle whitespace-nowrap border-l border-border bg-card shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.08)] transition-colors group-hover/row:bg-muted/40";

  return (
    <div className={shell}>
      <div className="overflow-x-auto">
        <table className={cn("w-full", inventoryStyle && "border-collapse text-sm")}>
          <thead
            className={
              inventoryStyle
                ? "bg-gradient-to-b from-muted/85 via-muted/70 to-muted/50 dark:from-muted/45 dark:via-muted/35 dark:to-muted/25"
                : undefined
            }
          >
            <tr
              className={cn(
                "border-b border-border/80",
                !inventoryStyle && "border-border bg-muted/50"
              )}
            >
              {columns.map((col) => {
                const actions = isActionsColumn(col);
                return (
                  <th
                    key={col.key}
                    className={cn(
                      thClass,
                      col.className,
                      actions && actionsThExtra
                    )}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-y divide-border",
              inventoryStyle && "divide-border/70 bg-muted/[0.08]"
            )}
          >
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={cn(emptyPadding, "text-center text-muted-foreground")}
                >
                  No data found
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    "group/row transition-colors",
                    inventoryStyle &&
                      "odd:bg-background/95 even:bg-muted/15 hover:bg-muted/35 dark:odd:bg-background/80 dark:even:bg-muted/20 dark:hover:bg-muted/30",
                    !inventoryStyle && "hover:bg-muted/30"
                  )}
                >
                  {columns.map((col) => {
                    const actions = isActionsColumn(col);
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          tdClass,
                          col.className,
                          actions && actionsTdExtra
                        )}
                      >
                        {col.render ? col.render(item, idx) : item[col.key]}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm ring-1 ring-black/[0.03] dark:border-border/60 dark:bg-card dark:ring-white/[0.06]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-foreground/[0.04] blur-2xl dark:bg-white/[0.06]"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {trend ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">{trend}</p>
          ) : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/50 text-foreground shadow-inner dark:bg-muted/30">
          <Icon className="h-5 w-5 opacity-90" strokeWidth={1.85} aria-hidden />
        </div>
      </div>
    </div>
  );
}

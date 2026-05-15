"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type AddOptionButtonProps = {
  onClick: () => void;
  "aria-label": string;
  title?: string;
  className?: string;
  disabled?: boolean;
};

/** Plus control beside comboboxes to open inline create modals (category, brand, unit). */
export function AddOptionButton({
  onClick,
  "aria-label": ariaLabel,
  title,
  className,
  disabled = false,
}: AddOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      disabled={disabled}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/90 bg-muted/40 text-foreground shadow-sm transition-colors",
        "hover:border-primary/45 hover:bg-primary/10 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}

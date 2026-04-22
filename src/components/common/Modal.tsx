"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Shown in a gradient tile next to the title (seller-admin style). */
  icon?: ReactNode;
  iconClassName?: string;
  /** Sticky footer below scrollable body (e.g. action buttons with icons). */
  footer?: ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Max width preset (seller-admin: `md` = max-w-2xl). Ignored if `className` sets another max-w- (use one or the other). */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * When true (Radix default), pointer events outside the dialog panel are disabled.
   * That breaks portaled Combobox/Select popups. Default false so dropdowns inside modals work.
   */
  modal?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon,
  iconClassName,
  footer,
  children,
  className,
  size,
  modal = false,
}: ModalProps) {
  // Add/remove body class for background blur effect
  useEffect(() => {
    if (open) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [open]);

  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "md"
        ? "max-w-2xl"
        : size === "lg"
          ? "max-w-4xl"
          : size === "xl"
            ? "max-w-6xl"
            : null;

  return (
    <Dialog.Root modal={modal} open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 backdrop-blur-sm bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-200 data-[state=closed]:duration-150"
        />
        <Dialog.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 flex max-h-[90vh] w-full translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden",
            "rounded-2xl border border-border/60 bg-card shadow-2xl ring-1 ring-black/[0.06]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-100",
            "data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-4",
            "data-[state=open]:duration-250 data-[state=closed]:duration-150",
            sizeClass ?? "max-w-lg",
            className
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-start gap-3 border-b border-border px-6 py-4",
              !icon && "items-center"
            )}
          >
            {icon ? (
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-sm",
                  iconClassName
                )}
              >
                {icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1 pt-0.5">
              <Dialog.Title className="text-lg font-semibold text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>

          {footer ? (
            <div className="flex w-full shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/25 px-6 py-3 sm:flex-row sm:items-center">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-card text-foreground shadow-lg rounded-lg",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
        },
      }}
    />
  );
}

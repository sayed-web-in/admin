import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 min-h-[42px] w-full min-w-0 items-center rounded-xl border border-border/70 bg-transparent px-3 py-2 text-sm transition-colors outline-none file:inline-flex file:h-8 file:shrink-0 file:cursor-pointer file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-transparent dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }

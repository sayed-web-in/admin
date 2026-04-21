"use client";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export function InventoryTablePagination({
  page,
  lastPage,
  total,
  loading,
  onPageChange,
  className,
}: {
  page: number;
  lastPage: number;
  total: number;
  loading?: boolean;
  onPageChange: (nextPage: number) => void;
  className?: string;
}) {
  const disabled = !!loading;
  const canPrev = page > 1;
  const canNext = page < lastPage;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{total}</span> total
        <span className="mx-2 text-border">·</span>
        Page <span className="font-medium text-foreground">{page}</span> of{" "}
        <span className="font-medium text-foreground">{lastPage}</span>
      </p>
      <Pagination className="mx-0 w-full justify-end sm:w-auto">
        <PaginationContent className="flex-wrap justify-end gap-1">
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 rounded-xl"
              disabled={disabled || !canPrev}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="size-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 rounded-xl"
              disabled={disabled || !canNext}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon className="size-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

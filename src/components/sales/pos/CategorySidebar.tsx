"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CategoryCard } from "@/components/sales/pos/CategoryCard";

export interface POSCategory {
  id: number;
  name: string;
  imageUrl?: string;
  image?: string;
  status?: string;
}

interface CategorySidebarProps {
  branchId: number | null;
  selectedCategoryId: number | null;
  onCategorySelect: (categoryId: number | null) => void;
  variant?: "vertical" | "horizontal";
}

const SKELETON_COUNT = 6;

type CategorySkeletonMode = "horizontal" | "vertical" | "responsive";

function CategorySkeleton({
  mode,
  count = SKELETON_COUNT,
}: {
  mode: CategorySkeletonMode;
  count?: number;
}) {
  const wrapperClass =
    mode === "horizontal"
      ? "flex gap-2 flex-nowrap"
      : mode === "vertical"
        ? "grid grid-cols-1 gap-1.5 w-full"
        : "flex gap-2 flex-nowrap w-full min-w-0 lg:grid lg:grid-cols-1 lg:gap-1.5";

  const itemClass =
    mode === "horizontal"
      ? "min-w-[72px] h-14 px-3"
      : mode === "vertical"
        ? "w-full aspect-square min-h-[84px] p-2"
        : "min-w-[72px] h-14 px-3 lg:min-w-0 lg:w-full lg:aspect-square lg:min-h-[84px] lg:p-2";

  return (
    <div className={wrapperClass}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg flex-shrink-0 border animate-pulse",
            "bg-slate-50 border-slate-200",
            itemClass
          )}
        >
          <div className="w-6 h-6 rounded-lg bg-slate-200 mb-1" />
          <div className="h-2.5 w-10 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export function POSCategorySidebar({
  branchId,
  selectedCategoryId,
  onCategorySelect,
  variant,
}: CategorySidebarProps) {
  const [categories, setCategories] = useState<POSCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const isHorizontal = variant === "horizontal";
  const isVertical = variant === "vertical";
  const responsive = variant == null;

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "100");
        if (branchId) params.set("branchId", String(branchId));
        const res = await apiFetch<POSCategory[] | { data?: POSCategory[]; categories?: POSCategory[] }>(
          `/categories?${params.toString()}`
        );
        const list = Array.isArray(res) ? res : res.data || res.categories || [];
        setCategories(list.filter((cat) => !cat.status || cat.status === "active"));
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchCategories();
  }, [branchId]);

  const horizontalLayout = isHorizontal || responsive;
  const verticalLayout = isVertical || responsive;

  const containerClass =
    horizontalLayout && !verticalLayout
      ? "w-full flex flex-col flex-shrink-0"
      : verticalLayout && !horizontalLayout
        ? "h-full flex flex-col min-h-0"
        : "w-full lg:w-auto h-auto lg:h-full lg:min-h-0 flex flex-col flex-shrink-0";

  const scrollClass =
    horizontalLayout && !verticalLayout
      ? "overflow-x-auto overflow-y-hidden py-2 px-1 flex gap-2 flex-1"
      : verticalLayout && !horizontalLayout
        ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5"
        : "flex gap-2 flex-nowrap overflow-x-auto overflow-y-hidden lg:overflow-x-hidden lg:overflow-y-auto lg:flex-col lg:flex-nowrap lg:flex-1 lg:min-h-0 py-2 px-1 lg:p-1.5";

  const listClass =
    horizontalLayout && !verticalLayout
      ? "flex gap-2 flex-nowrap"
      : verticalLayout && !horizontalLayout
        ? "grid grid-cols-1 gap-1.5"
        : "flex gap-2 flex-nowrap lg:grid lg:grid-cols-1 lg:gap-1.5";

  const btnSizeClass =
    horizontalLayout && !verticalLayout
      ? "min-w-[72px] h-14 px-3"
      : verticalLayout && !horizontalLayout
        ? "w-full aspect-square min-h-[84px] p-2"
        : "min-w-[72px] h-14 px-3 lg:min-w-0 lg:w-full lg:aspect-square lg:min-h-[84px] lg:p-2";

  const skeletonMode: CategorySkeletonMode =
    variant === "horizontal" ? "horizontal" : variant === "vertical" ? "vertical" : "responsive";

  return (
    <div className={containerClass}>
      <div className={scrollClass}>
        {loading ? (
          <CategorySkeleton mode={skeletonMode} />
        ) : (
          <div className={listClass}>
            <CategoryCard
              name="All"
              active={selectedCategoryId === null}
              sizeClass={btnSizeClass}
              onClick={() => onCategorySelect(null)}
            />

            {categories.map((category) => {
              const imageSrc = category.imageUrl || category.image;
              const active = selectedCategoryId === category.id;
              return (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  imageSrc={imageSrc}
                  active={active}
                  sizeClass={btnSizeClass}
                  onClick={() => onCategorySelect(category.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

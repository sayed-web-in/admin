"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { resolveMediaUrl } from "@/lib/media";

interface CategoryCardProps {
  name: string;
  imageSrc?: string;
  active: boolean;
  sizeClass: string;
  onClick: () => void;
}

export function CategoryCard({ name, imageSrc, active, sizeClass, onClick }: CategoryCardProps) {
  const resolvedImageSrc = imageSrc ? resolveMediaUrl(imageSrc) : "";
  const btnBase =
    "flex flex-col items-center justify-center rounded-lg transition-all backdrop-blur-sm flex-shrink-0";
  const btnActive =
    "bg-primary text-primary-foreground border-2 border-primary shadow-lg shadow-black/15";
  const btnInactive =
    "bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 hover:border-primary/40 hover:shadow-md";

  return (
    <button onClick={onClick} className={`${btnBase} ${active ? btnActive : btnInactive} ${sizeClass}`}>
      {resolvedImageSrc ? (
        <Image
          src={resolvedImageSrc}
          alt={name}
          width={24}
          height={24}
          className={`w-6 h-6 rounded-lg object-cover mb-1 ${active ? "ring-2 ring-primary-foreground/25" : ""}`}
          unoptimized
        />
      ) : (
        <Package className={`mb-1 h-6 w-6 ${active ? "text-primary-foreground" : "text-slate-900"}`} />
      )}
      <span
        className={`line-clamp-2 text-center text-sm font-semibold leading-tight ${active ? "text-primary-foreground" : "text-slate-900"}`}
      >
        {name}
      </span>
    </button>
  );
}

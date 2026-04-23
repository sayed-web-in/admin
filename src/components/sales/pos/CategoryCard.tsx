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
    "bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-2 border-indigo-500 shadow-lg shadow-indigo-500/30";
  const btnInactive =
    "bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 hover:border-indigo-300 hover:shadow-md";

  return (
    <button onClick={onClick} className={`${btnBase} ${active ? btnActive : btnInactive} ${sizeClass}`}>
      {resolvedImageSrc ? (
        <Image
          src={resolvedImageSrc}
          alt={name}
          width={24}
          height={24}
          className={`w-6 h-6 rounded-lg object-cover mb-1 ${active ? "ring-2 ring-white/30" : ""}`}
          unoptimized
        />
      ) : (
        <Package className={`w-6 h-6 mb-1 ${active ? "text-white" : "text-slate-900"}`} />
      )}
      <span
        className={`text-sm font-semibold text-center leading-tight line-clamp-2 ${active ? "text-white" : "text-slate-900"}`}
      >
        {name}
      </span>
    </button>
  );
}

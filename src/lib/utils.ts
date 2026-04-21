import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Whole taka (no decimals), Bengali digit grouping, ৳ prefix. */
export function formatPrice(value: number, _currency = "BDT"): string {
  if (Number.isNaN(value)) return "—"
  const n = Math.round(Number(value))
  const formatted = n.toLocaleString("en-BD")
  return `৳${formatted}`
}

export function formatDate(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** dd/mm/yyyy (seller-admin batch detail style). */
export function formatDateDDMMYYYY(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

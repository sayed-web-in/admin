import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** All displayed dates/times use Bangladesh civil time. */
export const APP_TIMEZONE = "Asia/Dhaka"

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

/** Seller-style money: ৳ with decimals (e.g. supplier transaction amounts). */
export function formatAmountDecimal(value: number): string {
  if (Number.isNaN(value)) return "—"
  const formatted = Number(value).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `৳${formatted}`
}

export function formatDate(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** dd/mm/yyyy in Bangladesh time (seller-admin batch detail style). */
export function formatDateDDMMYYYY(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** Parse API/local date for display; invalid → "—". */
export function formatDateTimeFromInput(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  return formatDateTime(d.toISOString())
}

/** e.g. 10/05/26, 1:17 am — Bangladesh wall clock. */
export function formatDateTime(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-GB", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/** e.g. 10 May 2026, 01:17 — Bangladesh. */
export function formatDateTimeMedShort(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-GB", {
    timeZone: APP_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/** Long weekday date + time in Bangladesh. */
export function formatDateTimeFullShort(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-GB", {
    timeZone: APP_TIMEZONE,
    dateStyle: "full",
    timeStyle: "short",
  })
}

/** Today as YYYY-MM-DD in Asia/Dhaka (for date inputs / API filters). */
export function todayYmdInDhaka(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !day) return new Date().toISOString().slice(0, 10)
  return `${y}-${m}-${day}`
}

/** First day of current month YYYY-MM-01 in Asia/Dhaka. */
export function firstDayOfMonthYmdInDhaka(): string {
  const [y, m] = todayYmdInDhaka().split("-")
  return `${y}-${m}-01`
}

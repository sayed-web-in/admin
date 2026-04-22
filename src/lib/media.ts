import { getApiUrl } from "@/lib/api";

export function resolveMediaUrl(url: string): string {
  if (!url) return "";
  if (
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }
  const base = getApiUrl();
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

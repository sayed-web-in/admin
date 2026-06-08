function parseApiUrls(): string[] {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw?.trim()) return [];

  return raw
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter((url) => {
      if (!url) return false;
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
}

export function getApiUrls(): string[] {
  const urls = parseApiUrls();
  if (urls.length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL is not set or invalid");
  }
  return urls;
}

export function getApiUrl(): string {
  return getApiUrls()[0];
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const url = `${getApiUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/login";
    }
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiUpload(path: string, formData: FormData): Promise<any> {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const url = `${getApiUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Product / variant images: server resizes and converts to WebP (`{ data: { url } }`, seller-admin shape). */
export async function uploadProductImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiUpload("/upload/product-image", fd);
  const url = res?.data?.url ?? res?.url;
  if (!url || typeof url !== "string") {
    throw new Error("Unexpected image upload response");
  }
  return url;
}

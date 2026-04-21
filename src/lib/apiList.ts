/** Normalize list responses: paginated `{ data }` or legacy `{ items|brands|... }`. */

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
};

export function unwrapPaginated<T>(res: unknown): PaginatedResponse<T> | null {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  if (!Array.isArray(r.data)) return null;
  const total = Number(r.total);
  const page = Number(r.page) || 1;
  const lastPage = Number(r.lastPage);
  return {
    data: r.data as T[],
    total: Number.isFinite(total) ? total : 0,
    page,
    lastPage: Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1,
  };
}

/**
 * @param keys legacy wrapper keys to try if `data` is missing (e.g. "brands", "units").
 */
export function extractApiList<T>(res: unknown, legacyKeys: string[] = []): T[] {
  const p = unwrapPaginated<T>(res);
  if (p) return p.data;
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    for (const k of legacyKeys) {
      const v = o[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

export function extractPaginatedOrList<T>(
  res: unknown,
  legacyKeys: string[] = []
): PaginatedResponse<T> | null {
  const p = unwrapPaginated<T>(res);
  if (p) return p;
  const list = extractApiList<T>(res, legacyKeys);
  if (list.length || (res && typeof res === "object" && legacyKeys.some((k) => k in (res as object))))
    return { data: list, total: list.length, page: 1, lastPage: 1 };
  return null;
}

export function extractBranches(data: unknown): { id: number; name: string }[] {
  if (Array.isArray(data)) return data as { id: number; name: string }[];
  if (data && typeof data === "object" && "branches" in data) {
    const b = (data as { branches?: unknown }).branches;
    if (Array.isArray(b)) return b as { id: number; name: string }[];
  }
  return [];
}

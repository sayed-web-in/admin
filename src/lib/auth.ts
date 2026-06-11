"use client";

import { getApiUrl } from "@/lib/api";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  branchId: number | null;
}

export function getAdminUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("admin_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function setAdminAuth(token: string, user: AdminUser) {
  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_user", JSON.stringify(user));
}

export function clearAdminAuth() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
}

export function getSelectedBranch(): number | null {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem("selected_branch");
  return val ? Number(val) : null;
}

export function setSelectedBranch(branchId: number) {
  localStorage.setItem("selected_branch", String(branchId));
  window.dispatchEvent(new Event("branch-changed"));
}

export type AdminSessionStatus = "ok" | "unauthorized" | "unreachable";

/** Verifies token with backend; does not redirect — caller decides. */
export async function validateAdminSession(): Promise<AdminSessionStatus> {
  const token = getAdminToken();
  if (!token) return "unauthorized";

  let apiUrl: string;
  try {
    apiUrl = getApiUrl();
  } catch {
    return "unreachable";
  }

  try {
    const res = await fetch(`${apiUrl}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      clearAdminAuth();
      return "unauthorized";
    }

    if (!res.ok) {
      return "unreachable";
    }

    return "ok";
  } catch {
    return "unreachable";
  }
}

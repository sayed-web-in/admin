"use client";

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

import { setAuthTokenGetter } from "@workspace/api-client-react";

const ADMIN_TOKEN_KEY = "farm_admin_jwt";
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

export interface AdminAccount {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface ErrorResponse {
  error?: string;
}

export async function adminLogin(
  email: string,
  password: string
): Promise<{ token: string; admin: AdminAccount }> {
  const res = await fetch(`${API_BASE}/api/admin-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || "Login failed");
  }
  return data;
}

export async function fetchAdmin<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const data: ErrorResponse = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  setAuthTokenGetter(() => getAdminToken());
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  setAuthTokenGetter(null);
}

export function initAdminAuth() {
  const token = getAdminToken();
  if (token) {
    setAuthTokenGetter(() => getAdminToken());
  }
}

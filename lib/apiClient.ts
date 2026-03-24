const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://nexora.nitypulse.com";

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  HEADERS: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  TIMEOUT: 15000,
} as const;

/* ─── Token Storage (localStorage-backed) ─── */

const KEYS = {
  ACCESS: "nexora_access_token",
  REFRESH: "nexora_refresh_token",
  USER: "nexora_user",
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

export const TokenStorage = {
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(KEYS.ACCESS);
  },

  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(KEYS.REFRESH);
  },

  getUser<T = Record<string, unknown>>(): T | null {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  saveTokens(access: string, refresh: string) {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.ACCESS, access);
    localStorage.setItem(KEYS.REFRESH, refresh);
    // Also set cookie for middleware auth check
    document.cookie = `nexora_access_token=${access}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  },

  saveUser(user: Record<string, unknown>) {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  clearAll() {
    if (!isBrowser()) return;
    localStorage.removeItem(KEYS.ACCESS);
    localStorage.removeItem(KEYS.REFRESH);
    localStorage.removeItem(KEYS.USER);
    document.cookie = "nexora_access_token=; path=/; max-age=0";
  },
};

/* ─── Header builder ─── */

export function getHeaders(
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    ...API_CONFIG.HEADERS,
    ...customHeaders,
  };

  const access = TokenStorage.getAccessToken();
  if (access) {
    headers.Authorization = `Bearer ${access}`;
  }

  return headers;
}

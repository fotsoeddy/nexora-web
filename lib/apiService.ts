import { API_CONFIG, getHeaders, TokenStorage } from "./apiClient";

/* ─── Helpers ─── */

function buildUrl(endpoint: string) {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return {} as T;

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const fieldError =
      body && typeof body === "object"
        ? Object.values(body).find(
            (v) => Array.isArray(v) && v.length > 0
          )
        : null;
    const detail =
      body?.detail ||
      body?.message ||
      (Array.isArray(fieldError) ? fieldError[0] : null) ||
      (typeof body === "string" ? body : null);
    throw new Error(
      detail || `API Error: ${response.status} ${response.statusText}`
    );
  }

  return (body ?? {}) as T;
}

/* ─── Refresh-token queue (prevents multiple concurrent refreshes) ─── */

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: Error | null, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

/* ─── Core fetch with auto-retry on 401 ─── */

async function fetchWithRetry<T>(
  endpoint: string,
  options: RequestInit,
  isFormData = false
): Promise<T> {
  let headers = getHeaders(
    (options.headers as Record<string, string>) || {}
  );
  if (isFormData) delete headers["Content-Type"];

  let response = await fetch(buildUrl(endpoint), { ...options, headers });

  // Attempt token refresh on 401 (skip for the login endpoint itself)
  if (response.status === 401 && !endpoint.includes("/api/auth/login")) {
    const refresh = TokenStorage.getRefreshToken();

    if (refresh) {
      if (isRefreshing) {
        // Another refresh is in progress — wait for it
        try {
          await new Promise((resolve, reject) =>
            failedQueue.push({ resolve, reject })
          );
          headers = getHeaders(
            (options.headers as Record<string, string>) || {}
          );
          if (isFormData) delete headers["Content-Type"];
          response = await fetch(buildUrl(endpoint), {
            ...options,
            headers,
          });
          return handleResponse<T>(response);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(buildUrl("/api/auth/refresh/"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          TokenStorage.saveTokens(data.access, data.refresh || refresh);
          processQueue(null, data.access);

          headers = getHeaders(
            (options.headers as Record<string, string>) || {}
          );
          if (isFormData) delete headers["Content-Type"];
          response = await fetch(buildUrl(endpoint), {
            ...options,
            headers,
          });
        } else {
          TokenStorage.clearAll();
          processQueue(new Error("Session expired"));
          // Redirect to login
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          throw new Error("Session expired. Please log in again.");
        }
      } catch (error) {
        TokenStorage.clearAll();
        processQueue(error as Error);
        throw error;
      } finally {
        isRefreshing = false;
      }
    } else {
      TokenStorage.clearAll();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }

  return handleResponse<T>(response);
}

/* ─── Public API ─── */

export const ApiService = {
  get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return fetchWithRetry<T>(endpoint, { ...options, method: "GET" });
  },

  post<T, B = unknown>(
    endpoint: string,
    body: B,
    options: RequestInit = {}
  ): Promise<T> {
    return fetchWithRetry<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  postFormData<T>(
    endpoint: string,
    formData: FormData,
    options: RequestInit = {}
  ): Promise<T> {
    return fetchWithRetry<T>(
      endpoint,
      { ...options, method: "POST", body: formData },
      true
    );
  },

  put<T, B = unknown>(
    endpoint: string,
    body: B,
    options: RequestInit = {}
  ): Promise<T> {
    return fetchWithRetry<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  patch<T, B = unknown>(
    endpoint: string,
    body: B,
    options: RequestInit = {}
  ): Promise<T> {
    return fetchWithRetry<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return fetchWithRetry<T>(endpoint, { ...options, method: "DELETE" });
  },
};

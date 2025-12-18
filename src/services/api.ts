const RAW_API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
// Normalize to host/base only; strip any trailing "/api" so paths can add it explicitly.
export const API_URL = RAW_API_URL.replace(/\/+$/, "").replace(/\/api$/, "");

type HttpMethod = "GET" | "POST" | "DELETE" | "PATCH";

async function request<T>(path: string, options: { method?: HttpMethod; body?: any; token?: string } = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const msg = data?.error || res.statusText || "Request failed";
    const error: any = new Error(msg);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, { method: "GET", token }),
  post: <T>(path: string, body?: any, token?: string) => request<T>(path, { method: "POST", body, token }),
  patch: <T>(path: string, body?: any, token?: string) => request<T>(path, { method: "PATCH", body, token }),
  delete: <T>(path: string, token?: string) => request<T>(path, { method: "DELETE", token }),
};

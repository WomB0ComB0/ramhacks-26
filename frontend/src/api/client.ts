import { getAuthToken } from "../lib/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Init = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(method: string, pathname: string, init: Init = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...init.headers,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...init,
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "unknown",
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, init?: Init) => request<T>("GET", path, init),
  post: <T = unknown>(path: string, body?: unknown, init?: Init) =>
    request<T>("POST", path, { ...init, body }),
  patch: <T = unknown>(path: string, body?: unknown, init?: Init) =>
    request<T>("PATCH", path, { ...init, body }),
  delete: <T = unknown>(path: string, init?: Init) => request<T>("DELETE", path, init),
};

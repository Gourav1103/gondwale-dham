"use client";

/** fetch() wrapper: JSON in/out, friendly error messages, sends to /login when signed out. */
export async function apiFetch<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw Object.assign(new Error("Could not reach the server. Check your internet connection."), { status: 0 });
  }

  if (res.status === 401 && typeof window !== "undefined") {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears in-memory state on sign-out
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error || `Request failed (${res.status}).`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data as T;
}

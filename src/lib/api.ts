const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const DEFAULT_TIMEOUT_MS = 25000;

export interface AuthSession {
  access_token: string;
  user_id: string;
  organisation_id: string;
  role: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  session?: AuthSession | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
    headers.set("X-Organisation-ID", session.organisation_id);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errBody.detail || `API Error (${res.status})`);
    }
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

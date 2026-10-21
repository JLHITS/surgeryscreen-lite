/** Tiny fetch helper for the admin UI. Throws an Error with the server's
 *  message on failure so callers can surface it in a toast. */
export async function api<T = unknown>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && (data.error as string)) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

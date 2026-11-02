const configuredApi = import.meta.env?.VITE_API_URL;
export const API =
  typeof configuredApi === "string"
    ? configuredApi.replace(/\/$/, "")
    : "http://localhost:3001";
export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("X-Admin-Request", "1");
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new window.Event("admin-session-ended"));
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || "The admin request failed. Please try again.",
    );
  }
  return response;
}
export async function adminJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return (await adminFetch(API + path, init)).json();
}

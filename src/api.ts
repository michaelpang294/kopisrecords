// Production uses the website origin, where the backend is mounted at /api.
// For a separate backend, set VITE_API_URL to its origin (without /api).
const configuredApi = import.meta.env.VITE_API_URL;
export const API =
  typeof configuredApi === "string"
    ? configuredApi.trim().replace(/\/+$/, "")
    : import.meta.env.DEV
      ? "http://localhost:3001"
      : "";

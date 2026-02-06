const ENV_API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
export const API_BASE_URL = ENV_API_BASE_URL;
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

const isLoopbackUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const resolveApiBaseUrl = (): string => {
  if (ENV_API_BASE_URL) {
    if (
      typeof window !== "undefined" &&
      isLoopbackUrl(ENV_API_BASE_URL) &&
      !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    ) {
      return window.location.origin;
    }
    return ENV_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
};

const buildApiUrl = (path: string): string => {
  const base = resolveApiBaseUrl();
  return base ? `${base}${path}` : path;
};

const buildHeaders = (headers?: HeadersInit) => ({
  ...(headers ?? {}),
  "x-api-key": API_KEY
});

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: buildHeaders(options.headers),
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message ?? "Request failed.";
    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const apiFetchBlob = async (path: string, options: RequestInit = {}): Promise<Blob> => {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: buildHeaders(options.headers),
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message ?? "Request failed.";
    throw new Error(message);
  }

  return response.blob();
};

export const buildEventSourceUrl = (
  path: string,
  params: Record<string, string | undefined> = {}
): string => {
  const base = resolveApiBaseUrl();
  if (!base) {
    const query = new URLSearchParams();
    if (API_KEY) query.set("apiKey", API_KEY);
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
  }

  const url = new URL(path, base);
  if (API_KEY) url.searchParams.set("apiKey", API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

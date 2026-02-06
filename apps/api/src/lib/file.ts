import path from "path";

const EXTENSION_MAP: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"]
};

export const isAllowedMime = (mimeType: string, allowed: string[]): boolean =>
  allowed.includes(mimeType);

export const isAllowedExtension = (filename: string, mimeType: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  const allowed = EXTENSION_MAP[mimeType] ?? [];
  return allowed.includes(ext);
};

export const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-zA-Z0-9._-]/g, "_");

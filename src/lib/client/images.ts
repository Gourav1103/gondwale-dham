"use client";

import { apiFetch } from "./api";
import type { ImageItem } from "@/lib/types";

const MAX_SIDE = 2000;

/**
 * Shrinks big phone photos before upload (faster uploads, smaller GitHub repo).
 * Falls back to the original file if the browser can't decode it (e.g. HEIC on Android/desktop).
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 300 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function uploadImage(file: File, folder: string, addedBy?: string): Promise<ImageItem> {
  const ready = await compressImage(file);
  const form = new FormData();
  form.append("file", ready);
  form.append("folder", folder);
  if (addedBy) form.append("addedBy", addedBy);
  return apiFetch<ImageItem>("/api/upload", { method: "POST", body: form });
}

// Same list and limit as /api/upload, so a bad file is reported right away instead of failing later.
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"];
const MAX_BYTES = 15 * 1024 * 1024;

/** Returns an error message, or null when the file can be uploaded. */
export function validateImage(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return `"${file.name}" is not a supported image (use JPG, PNG, WEBP or GIF).`;
  if (file.size > MAX_BYTES) return `"${file.name}" is too large (max 15 MB).`;
  return null;
}

export function onlyImages(files: FileList | File[] | null | undefined) {
  return Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
}

import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifyToken } from "./auth";
import { isOurPath } from "./storage";
import { ObjectId } from "mongodb";
import type { ImageItem, LinkItem } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const fail = (status: number, message: string) => new HttpError(status, message);

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/**
 * Wraps every API route: checks the password cookie (defence in depth — proxy.ts also checks)
 * and turns thrown errors into friendly JSON responses.
 */
export function api<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    if (!(await verifyToken(req.cookies.get(AUTH_COOKIE)?.value))) {
      return NextResponse.json({ error: "Please enter the app password first." }, { status: 401 });
    }
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(err);
      const message = err instanceof Error && /MONGODB_URI|GitHub|storage/i.test(err.message)
        ? err.message
        : "Something went wrong on the server. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

/** Throws 403 unless the visitor logged in with the admin password. */
export async function requireAdmin(req: NextRequest) {
  if ((await verifyToken(req.cookies.get(AUTH_COOKIE)?.value)) !== "admin") {
    throw fail(403, "Only an admin can delete a Shakti Peeth. Unlock admin with the admin password.");
  }
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw fail(400, "Invalid request body.");
  }
}

// ---- Input cleaning ----

export function text(value: unknown, max: number, field: string, required = false) {
  const v = typeof value === "string" ? value.trim() : "";
  if (required && !v) throw fail(400, `${field} is required.`);
  if (v.length > max) throw fail(400, `${field} is too long (max ${max} characters).`);
  return v;
}

export function optionalName(value: unknown) {
  return text(value, 60, "Name") || undefined;
}

export function cleanUrl(value: unknown) {
  let v = typeof value === "string" ? value.trim() : "";
  if (!v) throw fail(400, "Link URL is required.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw fail(400, `"${String(value).slice(0, 80)}" is not a valid link.`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw fail(400, "Only http/https links are allowed.");
  if (v.length > 2000) throw fail(400, "Link is too long.");
  return u.toString();
}

const newId = () => crypto.randomUUID();

/** Id made on the device (so a retried create returns the same record instead of a duplicate). */
export function clientObjectId(raw: unknown): ObjectId | null {
  return typeof raw === "string" && /^[0-9a-f]{24}$/.test(raw) ? new ObjectId(raw) : null;
}

export function clientUuid(raw: unknown): string | undefined {
  return typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw) ? raw.toLowerCase() : undefined;
}

/** Mongo duplicate-key error (same _id inserted twice by a retry). */
export const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

export function cleanLink(raw: unknown): LinkItem {
  const r = (raw ?? {}) as Partial<LinkItem>;
  return {
    id: typeof r.id === "string" && r.id.length <= 64 ? r.id : newId(),
    url: cleanUrl(r.url),
    title: text(r.title, 200, "Link title") || undefined,
    addedBy: optionalName(r.addedBy),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
  };
}

export function cleanLinks(raw: unknown): LinkItem[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 100) throw fail(400, "Invalid links.");
  return raw.map(cleanLink);
}

/** Images must come from our own upload endpoint (path inside our upload folder). */
export function cleanImage(raw: unknown): ImageItem {
  const r = (raw ?? {}) as Partial<ImageItem>;
  if (typeof r.url !== "string" || typeof r.path !== "string" || !isOurPath(r.path)) {
    throw fail(400, "Invalid image.");
  }
  if (!/^https:\/\//.test(r.url) && !r.url.startsWith("/uploads/")) throw fail(400, "Invalid image URL.");
  return {
    id: typeof r.id === "string" && r.id.length <= 64 ? r.id : newId(),
    url: r.url,
    path: r.path,
    sha: typeof r.sha === "string" ? r.sha : undefined,
    name: text(r.name, 200, "Image name") || undefined,
    addedBy: optionalName(r.addedBy),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
  };
}

export function cleanImages(raw: unknown): ImageItem[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 200) throw fail(400, "Invalid images.");
  return raw.map(cleanImage);
}

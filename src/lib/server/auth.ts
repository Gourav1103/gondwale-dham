// Password gate. A signed, httpOnly cookie proves the visitor entered the app password.
// Uses Web Crypto only, so it works both in proxy.ts and in route handlers.

export const AUTH_COOKIE = "harihaat_auth";
/** Readable by the page so it can show admin-only buttons. The signed AUTH_COOKIE is what the server trusts. */
export const ROLE_COOKIE = "harihaat_role";

export type Role = "admin" | "member";
const PREFIX: Record<Role, string> = { member: "v1", admin: "a1" };
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

/** "Shri  Ram " → "shri ram" — so small typing differences don't lock anyone out. */
export function normalizePassword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function appPassword() {
  return normalizePassword(process.env.APP_PASSWORD || "shri ram");
}

/** Separate password for admin-only actions (deleting a Shakti Peeth). Not set → nobody is admin. */
function adminPassword() {
  return normalizePassword(process.env.ADMIN_PASSWORD || "");
}

function secret() {
  // AUTH_SECRET should be set in production. The fallback still works, but changing
  // the password is then the only way to sign everybody out.
  return process.env.AUTH_SECRET || `harihaat-2026::${appPassword()}`;
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Which role this password gives, or null when it is wrong. */
export function checkPassword(input: string): Role | null {
  const value = normalizePassword(input);
  const admin = adminPassword();
  if (admin && safeEqual(value, admin)) return "admin";
  if (safeEqual(value, appPassword())) return "member";
  return null;
}

export async function createToken(role: Role = "member") {
  const expires = Date.now() + AUTH_MAX_AGE * 1000;
  const payload = `${PREFIX[role]}.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

/** The role in a valid token, or null. */
export async function verifyToken(token: string | undefined | null): Promise<Role | null> {
  if (!token) return null;
  const parts = token.split(".");
  const role = (Object.keys(PREFIX) as Role[]).find((r) => PREFIX[r] === parts[0]);
  if (parts.length !== 3 || !role) return null;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  const expected = await sign(`${parts[0]}.${parts[1]}`);
  return safeEqual(parts[2], expected) ? role : null;
}

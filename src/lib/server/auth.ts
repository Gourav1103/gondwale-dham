// Password gate. A signed, httpOnly cookie proves the visitor entered the app password.
// Uses Web Crypto only, so it works both in proxy.ts and in route handlers.

export const AUTH_COOKIE = "harihaat_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

/** "Shri  Ram " → "shri ram" — so small typing differences don't lock anyone out. */
export function normalizePassword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function appPassword() {
  return normalizePassword(process.env.APP_PASSWORD || "shri ram");
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

export function checkPassword(input: string) {
  return safeEqual(normalizePassword(input), appPassword());
}

export async function createToken() {
  const expires = Date.now() + AUTH_MAX_AGE * 1000;
  const payload = `v1.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyToken(token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await sign(`${parts[0]}.${parts[1]}`);
  return safeEqual(parts[2], expected);
}

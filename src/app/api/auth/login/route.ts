import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, ROLE_COOKIE, checkPassword, createToken } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  let password = "";
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? "");
  } catch {
    /* empty body */
  }

  const role = checkPassword(password);
  if (!role) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role });
  const cookie = { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: AUTH_MAX_AGE } as const;
  res.cookies.set(AUTH_COOKIE, await createToken(role), { ...cookie, httpOnly: true });
  res.cookies.set(ROLE_COOKIE, role, cookie);
  return res;
}

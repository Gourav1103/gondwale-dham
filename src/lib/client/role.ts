"use client";

import { useSyncExternalStore } from "react";

// The server puts the visitor's role in a readable cookie next to the signed login cookie.
// It only decides which buttons are shown — the server checks the signed cookie on every delete.

const COOKIE = "harihaat_role";
const listeners = new Set<() => void>();

function readRole(): "admin" | "member" {
  if (typeof document === "undefined") return "member";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`));
  return match?.[1] === "admin" ? "admin" : "member";
}

export function useIsAdmin() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      // Another tab may have unlocked admin.
      window.addEventListener("focus", fn);
      return () => {
        listeners.delete(fn);
        window.removeEventListener("focus", fn);
      };
    },
    () => readRole() === "admin",
    () => false,
  );
}

/** Log in again with the admin password, without logging out. Throws a friendly message on failure. */
export async function unlockAdmin(password: string) {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new Error("Could not reach the server. Check your internet connection.");
  }
  const data = (await res.json().catch(() => ({}))) as { role?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "Incorrect password. Please try again.");
  listeners.forEach((fn) => fn());
  if (data.role !== "admin") throw new Error("That is the team password, not the admin password.");
}

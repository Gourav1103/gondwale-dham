"use client";

import { useSyncExternalStore } from "react";

// The contributor's name is optional and kept only in this browser (LocalStorage),
// so ideas and notes can show "Added by …" without needing user accounts.

const KEY = "harihaat:name";
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setUserName(name: string) {
  try {
    const v = name.trim().slice(0, 60);
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — name just won't be remembered */
  }
  listeners.forEach((fn) => fn());
}

export function getUserName() {
  return typeof window === "undefined" ? "" : read();
}

export function useUserName() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      const onStorage = (e: StorageEvent) => e.key === KEY && fn();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(fn);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => "",
  );
}

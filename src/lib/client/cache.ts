"use client";

// Small "stale-while-revalidate" cache:
//   1. Show data from memory / IndexedDB instantly (works across page reloads).
//   2. Re-fetch from the server in the background if the data is older than `staleMs`,
//      and whenever the tab regains focus.
//   3. After every successful change, the UI writes the server's response into the cache,
//      so every page stays in sync without extra requests.
// MongoDB remains the source of truth — the cache is only a fast copy.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import { STORES, tx } from "./idb";

type Entry<T = unknown> = { data: T; ts: number };

const CACHE_VERSION = "v1";

const mem = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<unknown>>();
const errors = new Map<string, string>();
const hydrated = new Set<string>();

// IndexedDB "kv" store (falls back silently if unavailable) — see idb.ts.
const idb = <T,>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest) => tx<T>(STORES.kv, mode, run);

const fullKey = (key: string) => `${CACHE_VERSION}:${key}`;

// ---------------- Core API ----------------

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function getCached<T>(key: string): T | undefined {
  return mem.get(key)?.data as T | undefined;
}

export function setCache<T>(key: string, data: T) {
  const entry = { data, ts: Date.now() };
  mem.set(key, entry);
  errors.delete(key);
  hydrated.add(key);
  notify(key);
  void idb("readwrite", (s) => s.put(entry, fullKey(key)));
}

export function removeCache(key: string) {
  mem.delete(key);
  notify(key);
  void idb("readwrite", (s) => s.delete(fullKey(key)));
}

/** Update an item inside a cached list (or add it if missing). */
export function upsertInList<T extends { id: string }>(key: string, item: T, position: "start" | "end" = "start") {
  const list = getCached<T[]>(key);
  if (!list) return;
  const idx = list.findIndex((x) => x.id === item.id);
  const next = idx >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : position === "start" ? [item, ...list] : [...list, item];
  setCache(key, next);
}

export function removeFromList<T extends { id: string }>(key: string, id: string) {
  const list = getCached<T[]>(key);
  if (list) setCache(key, list.filter((x) => x.id !== id));
}

export async function clearAllCache() {
  mem.clear();
  hydrated.clear();
  await idb("readwrite", (s) => s.clear());
}

async function hydrate(key: string) {
  if (hydrated.has(key)) return;
  hydrated.add(key);
  const entry = await idb<Entry>("readonly", (s) => s.get(fullKey(key)));
  if (entry && !mem.has(key)) {
    mem.set(key, entry);
    notify(key);
  }
}

export function revalidate<T>(key: string, url: string): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = apiFetch<T>(url)
    .then((data) => {
      setCache(key, data);
      return data;
    })
    .catch((err: Error & { status?: number }) => {
      errors.set(key, err.message);
      if (err.status === 404) removeCache(key);
      notify(key);
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  notify(key);
  return p;
}

// ---------------- React hook ----------------

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

type Snapshot = { entry: Entry | undefined; error: string | undefined; loading: boolean };
const snapshots = new Map<string, Snapshot>();
const EMPTY: Snapshot = { entry: undefined, error: undefined, loading: false };

function snapshot(key: string): Snapshot {
  const entry = mem.get(key);
  const error = errors.get(key);
  const loading = inflight.has(key);
  const prev = snapshots.get(key);
  if (prev && prev.entry === entry && prev.error === error && prev.loading === loading) return prev;
  const next = { entry, error, loading };
  snapshots.set(key, next);
  return next;
}

export function useResource<T>(
  key: string,
  url: string,
  options: { staleMs?: number; placeholder?: () => T | undefined } = {},
) {
  const { staleMs = 20_000, placeholder } = options;
  const snap = useSyncExternalStore(
    useCallback((fn) => subscribe(key, fn), [key]),
    () => snapshot(key),
    () => EMPTY,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrate(key);
      if (cancelled) return;
      const entry = mem.get(key);
      if (!entry || Date.now() - entry.ts > staleMs) revalidate(key, url).catch(() => {});
    })();
    const onFocus = () => {
      const entry = mem.get(key);
      if (document.visibilityState === "visible" && (!entry || Date.now() - entry.ts > 5_000)) {
        revalidate(key, url).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [key, url, staleMs]);

  const data = (snap.entry?.data as T | undefined) ?? placeholder?.();
  return {
    data,
    error: snap.error,
    /** true only when there is nothing to show yet */
    isLoading: data === undefined && !snap.error,
    /** true while a background refresh is running */
    isRefreshing: snap.loading,
    refresh: useCallback(() => revalidate<T>(key, url), [key, url]),
  };
}

"use client";

// The outbox: changes saved on this device that still have to reach the server.
// Kept in IndexedDB so they survive reloads, closed tabs and lost network.
// Other tabs are told about every change (BroadcastChannel) and re-read it.

import { useSyncExternalStore } from "react";
import { STORES, openDb, tx, write } from "./idb";
import type { Op, OutboxEntry } from "./ops";
import { compactOnEnqueue } from "./pending";

let queue: OutboxEntry[] = [];
let loaded: Promise<void> | null = null;
let persistent = true;
let lastSeq = 0;
const previews = new Map<string, string>();
const listeners = new Set<() => void>();

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("harihaat-outbox") : null;
channel?.addEventListener("message", () => {
  loaded = null;
  void loadOutbox();
});

function emit(broadcast = true) {
  listeners.forEach((fn) => fn());
  if (broadcast) channel?.postMessage("changed");
}

const bySeq = (a: OutboxEntry, b: OutboxEntry) => a.seq - b.seq;

/** Image ids still needed by some queued op. */
function referencedImages(entries: OutboxEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const { op } of entries) {
    if (op.type === "image.upload") ids.add(op.imageId);
    else if (op.type === "peeth.addItem" && op.kind === "images") ids.add(op.item.id);
    else if (op.type === "idea.create") op.idea.images.forEach((i) => ids.add(i.id));
    else if (op.type === "idea.patch") op.patch.addImages?.forEach((i) => ids.add(i.id));
  }
  return ids;
}

export function loadOutbox(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      const db = await openDb();
      if (!db) {
        persistent = false;
        return;
      }
      const entries = (await tx<OutboxEntry[]>(STORES.outbox, "readonly", (s) => s.getAll())) ?? [];
      queue = entries.sort(bySeq);
      lastSeq = Math.max(lastSeq, ...queue.map((e) => e.seq), 0);

      const keys = (await tx<IDBValidKey[]>(STORES.blobs, "readonly", (s) => s.getAllKeys())) ?? [];
      for (const key of keys) {
        const id = String(key);
        if (previews.has(id)) continue;
        const blob = await tx<Blob>(STORES.blobs, "readonly", (s) => s.get(id));
        if (blob) previews.set(id, URL.createObjectURL(blob));
      }
      emit(false);
    })();
  }
  return loaded;
}

export const isPersistent = () => persistent;
export const getQueue = () => queue;
export const previewUrl = (imageId: string) => previews.get(imageId);

export async function getBlob(imageId: string): Promise<Blob | undefined> {
  return tx<Blob>(STORES.blobs, "readonly", (s) => s.get(imageId));
}

function nextSeq() {
  // Time-based start keeps order across reloads even after the queue was emptied.
  lastSeq = Math.max(lastSeq + 1, Date.now());
  return lastSeq;
}

/**
 * Save a change on the device. Resolves false when it could not be saved
 * (no IndexedDB, quota full) — the caller then talks to the server directly.
 */
export async function enqueue(op: Op, blob?: { imageId: string; file: Blob }): Promise<boolean> {
  await loadOutbox();
  if (!persistent) return false;

  const { drop, enqueue: add } = compactOnEnqueue(queue, op);
  if (drop.length) await removeEntries(drop, false);
  if (!add) {
    emit();
    return true;
  }

  if (blob) {
    const ok = await write(STORES.blobs, (s) => s.put(blob.file, blob.imageId));
    if (!ok) return fail();
    if (!previews.has(blob.imageId)) previews.set(blob.imageId, URL.createObjectURL(blob.file));
  }
  const entry: OutboxEntry = { id: crypto.randomUUID(), seq: nextSeq(), createdAt: Date.now(), op, status: "pending", attempts: 0 };
  if (!(await write(STORES.outbox, (s) => s.put(entry)))) return fail();
  queue = [...queue, entry].sort(bySeq);
  emit();
  return true;
}

function fail() {
  persistent = false;
  return false;
}

export async function updateEntry(id: string, patch: Partial<OutboxEntry>): Promise<void> {
  const current = queue.find((e) => e.id === id);
  if (!current) return;
  await replaceEntries([{ ...current, ...patch, id }]);
}

export async function replaceEntries(entries: OutboxEntry[]): Promise<void> {
  if (!entries.length) return;
  const byId = new Map(entries.map((e) => [e.id, e]));
  queue = queue.map((e) => byId.get(e.id) ?? e);
  await write(STORES.outbox, (s) => entries.forEach((e) => s.put(e)));
  emit();
}

export async function removeEntries(ids: string[], notify = true): Promise<void> {
  if (!ids.length) return;
  const gone = new Set(ids);
  const removed = queue.filter((e) => gone.has(e.id));
  queue = queue.filter((e) => !gone.has(e.id));
  await write(STORES.outbox, (s) => ids.forEach((id) => s.delete(id)));

  // Drop photos no queued op needs any more.
  const stillNeeded = referencedImages(queue);
  const unused = [...referencedImages(removed)].filter((id) => !stillNeeded.has(id));
  if (unused.length) {
    await write(STORES.blobs, (s) => unused.forEach((id) => s.delete(id)));
    // Keep the preview URL alive a little: the tile may still show it until the server copy arrives.
    setTimeout(() => unused.forEach((id) => {
      const url = previews.get(id);
      if (url) URL.revokeObjectURL(url);
      previews.delete(id);
    }), 60_000);
  }
  if (notify) emit();
}

export function subscribeOutbox(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const EMPTY: OutboxEntry[] = [];
export function useOutbox(): OutboxEntry[] {
  return useSyncExternalStore(subscribeOutbox, getQueue, () => EMPTY);
}

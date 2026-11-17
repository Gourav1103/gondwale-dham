"use client";

// Background sync: sends the outbox to the server, one change at a time, in order.
// Only one tab sends at a time (Web Locks); the others just show the shared queue.

import { useSyncExternalStore } from "react";
import type { Idea, ImageItem, Peeth } from "@/lib/types";
import { entityOf, type OutboxEntry } from "./ops";
import { getBlob, getQueue, loadOutbox, removeEntries, replaceEntries, subscribeOutbox, updateEntry } from "./outbox";
import { forgetIdea, forgetPeeth, refreshEntity, storeIdea, storePeeth } from "./store";
import { backoffMs, classify, nextRunnable, requestFor, resolveUpload } from "./sync-rules";

export type SyncStatus = { state: "idle" | "syncing" | "offline" | "auth" | "failed"; pending: number; failed: number };

let authPaused = false;
let offline = false;
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const statusListeners = new Set<() => void>();
const droppedListeners = new Set<(entity: string) => void>();

// ---------------- Status ----------------

let lastStatus: SyncStatus = { state: "idle", pending: 0, failed: 0 };

function computeStatus(): SyncStatus {
  const q = getQueue();
  const failed = q.filter((e) => e.status === "failed").length;
  const pending = q.length - failed;
  const state: SyncStatus["state"] =
    authPaused && pending ? "auth" : offline && pending ? "offline" : pending ? "syncing" : failed ? "failed" : "idle";
  const next = { state, pending, failed };
  if (next.state !== lastStatus.state || next.pending !== lastStatus.pending || next.failed !== lastStatus.failed) lastStatus = next;
  return lastStatus;
}

export const getSyncStatus = () => computeStatus();
const notifyStatus = () => statusListeners.forEach((fn) => fn());

function subscribeStatus(fn: () => void) {
  statusListeners.add(fn);
  const off = subscribeOutbox(fn);
  return () => {
    statusListeners.delete(fn);
    off();
  };
}

const IDLE: SyncStatus = { state: "idle", pending: 0, failed: 0 };
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeStatus, computeStatus, () => IDLE);
}

export function onEntityDropped(fn: (entity: string) => void) {
  droppedListeners.add(fn);
  return () => {
    droppedListeners.delete(fn);
  };
}

// ---------------- Sending one change ----------------

type Answer = { status: number; data: unknown };

async function send(entry: OutboxEntry): Promise<Answer> {
  const req = requestFor(entry.op);
  let body: BodyInit | undefined;
  const headers: Record<string, string> = {};

  if (req.form && entry.op.type === "image.upload") {
    const blob = await getBlob(entry.op.imageId);
    if (!blob) return { status: 400, data: { error: "This photo is no longer saved on this device. Please add it again." } };
    const form = new FormData();
    form.append("file", new File([blob], entry.op.name, { type: blob.type }));
    form.append("folder", entry.op.folder);
    form.append("id", entry.op.imageId);
    if (entry.op.addedBy) form.append("addedBy", entry.op.addedBy);
    body = form;
  } else if (req.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(req.json);
  }

  try {
    const res = await fetch(req.url, { method: req.method, headers, body, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { status: 0, data: {} };
  }
}

/** Put the server's answer into the read cache. */
async function applyResult(entry: OutboxEntry, data: unknown) {
  const op = entry.op;
  switch (op.type) {
    case "idea.create":
    case "idea.patch":
      storeIdea(data as Idea);
      break;
    case "idea.delete":
      forgetIdea(op.id);
      break;
    case "peeth.delete":
      forgetPeeth(op.id);
      break;
    case "image.upload":
      await replaceEntries(resolveUpload(getQueue(), { ...(data as ImageItem), id: op.imageId }));
      break;
    default:
      // A delete of an item that was already gone answers 404 without a body.
      if (data && typeof data === "object" && "id" in data) storePeeth(data as Peeth);
      else refreshEntity(entityOf(op));
  }
}

async function process(entry: OutboxEntry) {
  await updateEntry(entry.id, { status: "syncing" });
  const { status, data } = await send(entry);
  const message = (data as { error?: string })?.error;

  switch (classify(entry.op, status)) {
    case "done":
      offline = false;
      await applyResult(entry, data);
      await removeEntries([entry.id]);
      return true;
    case "retry": {
      offline = status === 0 || (typeof navigator !== "undefined" && navigator.onLine === false);
      const attempts = entry.attempts + 1;
      await updateEntry(entry.id, { status: "pending", attempts, nextTryAt: Date.now() + backoffMs(attempts), lastError: message });
      return true;
    }
    case "auth":
      authPaused = true;
      await updateEntry(entry.id, { status: "pending" });
      return false;
    case "drop-entity": {
      const ent = entityOf(entry.op);
      const ids = getQueue()
        .filter((e) => e.seq >= entry.seq && entityOf(e.op) === ent)
        .map((e) => e.id);
      await removeEntries(ids);
      droppedListeners.forEach((fn) => fn(ent));
      refreshEntity(ent);
      return true;
    }
    case "failed":
      await updateEntry(entry.id, { status: "failed", lastError: message || `Request failed (${status}).` });
      return true;
  }
}

// ---------------- The loop ----------------

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  const waits = getQueue()
    .filter((e) => e.status === "pending" && e.nextTryAt)
    .map((e) => e.nextTryAt!);
  if (!waits.length || authPaused) return;
  const delay = Math.max(0, Math.min(...waits) - Date.now());
  timer = setTimeout(kick, delay);
}

/** Send everything that can be sent right now. Resolves when nothing more can run. */
export function runOnce(): Promise<void> {
  if (running) return running;
  const loop = async () => {
    await loadOutbox();
    while (!authPaused) {
      const entry = nextRunnable(getQueue(), Date.now());
      if (!entry) break;
      if (!(await process(entry))) break;
      notifyStatus();
    }
    notifyStatus();
    schedule();
  };
  const withLock = () =>
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("harihaat-sync", { ifAvailable: true }, async (lock) => {
          if (lock) await loop(); // another tab holds it → that tab is sending
        })
      : loop();
  running = Promise.resolve(withLock()).finally(() => {
    running = null;
  }) as Promise<void>;
  return running;
}

export function kick() {
  void runOnce();
}

/** Changes left "syncing" by a closed tab go back in line (servers treat repeats safely). */
export async function recoverStuck() {
  await loadOutbox();
  const stuck = getQueue().filter((e) => e.status === "syncing");
  if (stuck.length) await replaceEntries(stuck.map((e) => ({ ...e, status: "pending" as const })));
}

export async function retryEntry(id: string) {
  authPaused = false;
  await updateEntry(id, { status: "pending", attempts: 0, nextTryAt: 0, lastError: undefined });
  kick();
}

/** Throw away a change and the later changes to the same record. The screen falls back to server data. */
export async function discardEntry(id: string) {
  const entry = getQueue().find((e) => e.id === id);
  if (!entry) return;
  const ent = entityOf(entry.op);
  await removeEntries(getQueue().filter((e) => e.seq >= entry.seq && entityOf(e.op) === ent).map((e) => e.id));
  refreshEntity(ent);
  kick();
}

/** Resume after logging in again. */
export function resumeAfterLogin() {
  authPaused = false;
  kick();
}

let started = false;
export function startSync(): () => void {
  if (started || typeof window === "undefined") return () => {};
  started = true;
  const wake = () => {
    offline = false;
    authPaused = false; // a 401 again will pause it again
    // Waiting entries may go now.
    void replaceEntries(getQueue().filter((e) => e.status === "pending" && e.nextTryAt).map((e) => ({ ...e, nextTryAt: 0 }))).then(kick);
  };
  const onVisible = () => document.visibilityState === "visible" && wake();
  window.addEventListener("online", wake);
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", onVisible);
  const offQueue = subscribeOutbox(() => {
    if (!running) kick();
  });
  void recoverStuck().then(kick);
  return () => {
    started = false;
    window.removeEventListener("online", wake);
    window.removeEventListener("focus", wake);
    document.removeEventListener("visibilitychange", onVisible);
    offQueue();
    if (timer) clearTimeout(timer);
  };
}

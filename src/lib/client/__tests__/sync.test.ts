import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Idea, ImageItem, Peeth } from "@/lib/types";

type Call = { url: string; method: string; body?: unknown };
let calls: Call[] = [];
let responder: (c: Call) => { status: number; json?: unknown } | "network";

const idea = (id: string, over: Partial<Idea> = {}): Idea => ({ id, title: "t", description: "", links: [], images: [], createdAt: "x", updatedAt: "x", ...over });
const peeth = (id: string, over: Partial<Peeth> = {}): Peeth => ({ id, number: 1, name: "n", place: "", description: "", images: [], links: [], notes: [], createdAt: "x", updatedAt: "x", ...over });

async function load() {
  vi.resetModules();
  const outbox = await import("../outbox");
  const sync = await import("../sync");
  const cache = await import("../cache");
  await outbox.loadOutbox();
  return { outbox, sync, cache };
}

/** Run the loop until nothing more can run right now. */
async function drain(sync: typeof import("../sync")) {
  await sync.runOnce();
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  calls = [];
  responder = (c) => ({ status: 200, json: c.method === "DELETE" ? { ok: true } : idea("srv") });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:test", revokeObjectURL: () => {} }));
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const body = init.body instanceof FormData ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "<file>"])) : init.body ? JSON.parse(String(init.body)) : undefined;
    const call = { url, method: init.method ?? "GET", body };
    calls.push(call);
    const r = responder(call);
    if (r === "network") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status, headers: { "content-type": "application/json" } });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("sync runner", () => {
  it("sends ops in seq order and empties the queue on 2xx", async () => {
    const { outbox, sync, cache } = await load();
    responder = (c) => (c.method === "DELETE" ? { status: 200, json: { ok: true } } : { status: 201, json: idea("a", { title: "server" }) });
    await outbox.enqueue({ type: "idea.create", idea: idea("a") });
    await outbox.enqueue({ type: "idea.patch", id: "a", patch: { title: "server" } });
    await outbox.enqueue({ type: "idea.delete", id: "b" });
    await drain(sync);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/ideas", "PATCH /api/ideas/a", "DELETE /api/ideas/b"]);
    expect(outbox.getQueue()).toEqual([]);
    expect(cache.getCached<Idea>("idea:a")?.title).toBe("server");
  });

  it("network error schedules retry with backoff and keeps the entry", async () => {
    const { outbox, sync } = await load();
    responder = () => "network";
    await outbox.enqueue({ type: "idea.delete", id: "a" });
    const before = Date.now();
    await drain(sync);
    const [e] = outbox.getQueue();
    expect(e.status).toBe("pending");
    expect(e.attempts).toBe(1);
    expect(e.nextTryAt! - before).toBeGreaterThanOrEqual(2000);
    expect(sync.getSyncStatus().state).toBe("offline");
    expect(calls).toHaveLength(1); // not hammered
  });

  it("401 sets state auth and does not call window.location", async () => {
    const { outbox, sync } = await load();
    const loc = { href: "/x" };
    vi.stubGlobal("window", { location: loc, addEventListener() {}, removeEventListener() {} });
    responder = () => ({ status: 401, json: { error: "Please enter the app password first." } });
    await outbox.enqueue({ type: "idea.delete", id: "a" });
    await outbox.enqueue({ type: "idea.delete", id: "b" });
    await drain(sync);
    expect(sync.getSyncStatus()).toMatchObject({ state: "auth", pending: 2 });
    expect(loc.href).toBe("/x");
    expect(calls).toHaveLength(1); // paused after the first 401
  });

  it("404 on idea.patch drops later ops for that idea only", async () => {
    const { outbox, sync } = await load();
    const dropped: string[] = [];
    sync.onEntityDropped((e) => dropped.push(e));
    responder = (c) => (c.url === "/api/ideas/a" ? { status: 404, json: { error: "gone" } } : { status: 200, json: { ok: true } });
    await outbox.enqueue({ type: "idea.patch", id: "a", patch: { title: "1" } });
    await outbox.enqueue({ type: "idea.patch", id: "a", patch: { title: "2" } });
    await outbox.enqueue({ type: "peeth.deleteItem", peethId: "p", kind: "notes", itemId: "n" });
    await drain(sync);
    expect(calls.filter((c) => c.method !== "GET").map((c) => c.url)).toEqual(["/api/ideas/a", "/api/peeths/p/notes/n"]);
    expect(outbox.getQueue()).toEqual([]);
    expect(dropped).toEqual(["idea:a"]);
    // the screen is refreshed from the server so the deleted idea disappears
    expect(calls.some((c) => c.method === "GET" && c.url === "/api/ideas")).toBe(true);
  });

  it("400 marks the entry failed, keeps its message, and other entities continue", async () => {
    const { outbox, sync } = await load();
    responder = (c) => (c.url === "/api/ideas/a" ? { status: 400, json: { error: "Idea title is required." } } : { status: 200, json: { ok: true } });
    await outbox.enqueue({ type: "idea.patch", id: "a", patch: { title: "" } });
    await outbox.enqueue({ type: "idea.delete", id: "b" });
    await drain(sync);
    expect(outbox.getQueue()).toHaveLength(1);
    expect(outbox.getQueue()[0]).toMatchObject({ status: "failed", lastError: "Idea title is required." });
    expect(sync.getSyncStatus()).toMatchObject({ state: "failed", failed: 1 });
  });

  it("image.upload result is substituted into the following peeth.addItem before it is sent", async () => {
    const { outbox, sync } = await load();
    const uploaded: ImageItem = { id: "img1", url: "https://raw/img1.webp", path: "harihaat-2026/peeths/p/img1.webp", sha: "s", createdAt: "y" };
    responder = (c) => (c.url === "/api/upload" ? { status: 201, json: uploaded } : { status: 201, json: peeth("p", { images: [uploaded] }) });
    await outbox.enqueue({ type: "image.upload", imageId: "img1", folder: "peeths/p", name: "a.webp", entity: "peeth:p" }, { imageId: "img1", file: new Blob(["x"], { type: "image/webp" }) });
    await outbox.enqueue({ type: "peeth.addItem", peethId: "p", kind: "images", item: { id: "img1", url: "", path: "", createdAt: "x", pending: true } });
    await drain(sync);
    expect(calls[0]).toMatchObject({ url: "/api/upload", body: { id: "img1", folder: "peeths/p", file: "<file>" } });
    expect(calls[1]).toMatchObject({ url: "/api/peeths/p/images", body: { images: [uploaded] } });
    expect(outbox.getQueue()).toEqual([]);
    expect(await outbox.getBlob("img1")).toBeUndefined();
  });

  it("entry stuck in syncing at startup is retried", async () => {
    let { outbox, sync } = await load();
    await outbox.enqueue({ type: "idea.delete", id: "a" });
    await outbox.updateEntry(outbox.getQueue()[0].id, { status: "syncing" });
    ({ outbox, sync } = await load()); // "reload the page"
    await sync.recoverStuck();
    await drain(sync);
    expect(calls.map((c) => c.url)).toEqual(["/api/ideas/a"]);
    expect(outbox.getQueue()).toEqual([]);
  });

  it("retryEntry re-sends a failed entry; discardEntry removes it and later ones of the same entity", async () => {
    const { outbox, sync } = await load();
    responder = () => ({ status: 400, json: { error: "bad" } });
    await outbox.enqueue({ type: "idea.patch", id: "a", patch: { title: "1" } });
    await outbox.enqueue({ type: "idea.patch", id: "a", patch: { title: "2" } });
    await drain(sync);
    responder = () => ({ status: 200, json: idea("a") });
    await sync.retryEntry(outbox.getQueue()[0].id);
    await drain(sync);
    expect(outbox.getQueue()).toEqual([]);

    responder = () => ({ status: 400, json: { error: "bad" } });
    await outbox.enqueue({ type: "idea.patch", id: "c", patch: { title: "1" } });
    await outbox.enqueue({ type: "idea.patch", id: "c", patch: { title: "2" } });
    await drain(sync);
    await sync.discardEntry(outbox.getQueue()[0].id);
    expect(outbox.getQueue()).toEqual([]);
  });
});

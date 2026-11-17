import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Idea } from "@/lib/types";

// Fresh database and fresh module state for each test = "a new page load".
async function freshLoad() {
  vi.resetModules();
  const mod = await import("../outbox");
  await mod.loadOutbox();
  return mod;
}
async function reload() {
  vi.resetModules();
  const mod = await import("../outbox");
  await mod.loadOutbox();
  return mod;
}

const idea = (id: string): Idea => ({ id, title: "t", description: "", links: [], images: [], createdAt: "x", updatedAt: "x" });

let urlCount = 0;
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  urlCount = 0;
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => `blob:test/${++urlCount}`, revokeObjectURL: () => {} }));
});

describe("outbox", () => {
  it("enqueue persists and survives a fresh load", async () => {
    const a = await freshLoad();
    expect(await a.enqueue({ type: "idea.delete", id: "x" })).toBe(true);
    const b = await reload();
    expect(b.getQueue().map((e) => e.op)).toEqual([{ type: "idea.delete", id: "x" }]);
    expect(b.getQueue()[0].status).toBe("pending");
  });

  it("blob is stored and previewUrl returns a blob: URL after reload", async () => {
    const a = await freshLoad();
    await a.enqueue(
      { type: "image.upload", imageId: "img1", folder: "ideas", name: "a.webp", entity: "idea:i" },
      { imageId: "img1", file: new Blob(["abc"], { type: "image/webp" }) },
    );
    const b = await reload();
    expect(b.previewUrl("img1")).toMatch(/^blob:/);
    const blob = await b.getBlob("img1");
    expect(blob).toBeDefined();
    expect(await blob!.text()).toBe("abc");
  });

  it("removeEntries deletes the blob when no entry references it", async () => {
    const a = await freshLoad();
    await a.enqueue(
      { type: "image.upload", imageId: "img2", folder: "ideas", name: "a.webp", entity: "idea:i" },
      { imageId: "img2", file: new Blob(["x"]) },
    );
    const add = { id: "img2", url: "", path: "", createdAt: "x", pending: true };
    await a.enqueue({ type: "peeth.addItem", peethId: "p", kind: "images", item: add });
    const [up, attach] = a.getQueue();
    await a.removeEntries([up.id]);
    expect(await a.getBlob("img2")).toBeDefined(); // still referenced by the attach op
    await a.removeEntries([attach.id]);
    expect(await a.getBlob("img2")).toBeUndefined();
  });

  it("enqueue applies compactOnEnqueue (create+delete of same pending idea leaves queue empty)", async () => {
    const a = await freshLoad();
    await a.enqueue({ type: "idea.create", idea: idea("abc") });
    expect(await a.enqueue({ type: "idea.delete", id: "abc" })).toBe(true);
    expect(a.getQueue()).toEqual([]);
    const b = await reload();
    expect(b.getQueue()).toEqual([]);
  });

  it("seq keeps increasing across reloads", async () => {
    const a = await freshLoad();
    await a.enqueue({ type: "idea.delete", id: "1" });
    const b = await reload();
    await b.enqueue({ type: "idea.delete", id: "2" });
    const [first, second] = b.getQueue();
    expect(second.seq).toBeGreaterThan(first.seq);
  });

  it("updateEntry and replaceEntries persist", async () => {
    const a = await freshLoad();
    await a.enqueue({ type: "idea.delete", id: "1" });
    const e = a.getQueue()[0];
    await a.updateEntry(e.id, { status: "failed", lastError: "nope" });
    await a.replaceEntries([{ ...a.getQueue()[0], attempts: 3 }]);
    const b = await reload();
    expect(b.getQueue()[0]).toMatchObject({ status: "failed", lastError: "nope", attempts: 3 });
  });

  it("reports not persistent when IndexedDB is missing, and enqueue returns false", async () => {
    // @ts-expect-error simulate a browser without IndexedDB
    globalThis.indexedDB = undefined;
    const a = await freshLoad();
    expect(a.isPersistent()).toBe(false);
    expect(await a.enqueue({ type: "idea.delete", id: "1" })).toBe(false);
  });
});

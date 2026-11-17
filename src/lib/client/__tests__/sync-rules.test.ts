import { describe, expect, it } from "vitest";
import type { Idea, ImageItem } from "@/lib/types";
import type { Op, OutboxEntry } from "../ops";
import { backoffMs, classify, nextRunnable, requestFor, resolveUpload } from "../sync-rules";

let seq = 0;
const entry = (op: Op, over: Partial<OutboxEntry> = {}): OutboxEntry => ({ id: `e${++seq}`, seq, createdAt: 0, op, status: "pending", attempts: 0, ...over });
const idea = (id: string, images: ImageItem[] = []): Idea => ({ id, title: "t", description: "", links: [], images, createdAt: "x", updatedAt: "x" });
const placeholder: ImageItem = { id: "img1", url: "", path: "", createdAt: "x", pending: true };
const uploaded: ImageItem = { id: "img1", url: "https://raw/x.webp", path: "harihaat/x.webp", sha: "abc", createdAt: "y" };

describe("classify", () => {
  const patch: Op = { type: "idea.patch", id: "a", patch: { title: "x" } };
  const del: Op = { type: "peeth.deleteItem", peethId: "p", kind: "notes", itemId: "n" };
  it.each([
    [200, patch, "done"],
    [201, patch, "done"],
    [0, patch, "retry"],
    [503, patch, "retry"],
    [429, patch, "retry"],
    [408, patch, "retry"],
    [401, patch, "auth"],
    [404, del, "done"],
    [404, patch, "drop-entity"],
    [400, patch, "failed"],
    [413, patch, "failed"],
  ] as const)("status %i → %s", (status, op, out) => {
    expect(classify(op, status)).toBe(out);
  });
});

describe("backoffMs", () => {
  it("doubles from 2s and caps at 60s", () => {
    expect([1, 2, 3, 10].map(backoffMs)).toEqual([2000, 4000, 8000, 60000]);
  });
});

describe("nextRunnable", () => {
  it("skips entries with nextTryAt in the future", () => {
    const a = entry({ type: "idea.delete", id: "a" }, { nextTryAt: 5000 });
    const b = entry({ type: "idea.delete", id: "b" });
    expect(nextRunnable([a, b], 1000)?.id).toBe(b.id);
    expect(nextRunnable([a, b], 6000)?.id).toBe(a.id);
  });

  it("failed entry for idea:A blocks later idea:A entries but not peeth:B", () => {
    const a1 = entry({ type: "idea.patch", id: "A", patch: { title: "1" } }, { status: "failed" });
    const a2 = entry({ type: "idea.patch", id: "A", patch: { title: "2" } });
    const b = entry({ type: "peeth.delete", id: "B" });
    expect(nextRunnable([a1, a2, b], 0)?.id).toBe(b.id);
    expect(nextRunnable([a1, a2], 0)).toBeUndefined();
  });

  it("an entry waiting for retry also blocks later entries of the same entity", () => {
    const a1 = entry({ type: "idea.patch", id: "A", patch: { title: "1" } }, { nextTryAt: 9999, attempts: 1 });
    const a2 = entry({ type: "idea.patch", id: "A", patch: { title: "2" } });
    expect(nextRunnable([a1, a2], 0)).toBeUndefined();
  });

  it("does not pick an entry already syncing", () => {
    expect(nextRunnable([entry({ type: "idea.delete", id: "a" }, { status: "syncing" })], 0)).toBeUndefined();
  });
});

describe("requestFor", () => {
  it("idea.create → POST /api/ideas with id", () => {
    const r = requestFor({ type: "idea.create", idea: idea("abc") });
    expect(r).toMatchObject({ url: "/api/ideas", method: "POST" });
    expect((r.json as { id: string }).id).toBe("abc");
  });
  it("idea.patch → PATCH /api/ideas/:id", () => {
    expect(requestFor({ type: "idea.patch", id: "abc", patch: { title: "n" } })).toEqual({ url: "/api/ideas/abc", method: "PATCH", json: { title: "n" } });
  });
  it("idea.delete / peeth.delete / peeth.deleteItem → DELETE", () => {
    expect(requestFor({ type: "idea.delete", id: "a" })).toEqual({ url: "/api/ideas/a", method: "DELETE" });
    expect(requestFor({ type: "peeth.delete", id: "p" })).toEqual({ url: "/api/peeths/p", method: "DELETE" });
    expect(requestFor({ type: "peeth.deleteItem", peethId: "p", kind: "links", itemId: "l" })).toEqual({ url: "/api/peeths/p/links/l", method: "DELETE" });
  });
  it("peeth.addItem notes → POST /api/peeths/:id/notes with { id, text, addedBy }", () => {
    const r = requestFor({ type: "peeth.addItem", peethId: "p", kind: "notes", item: { id: "n1", text: "hi", addedBy: "Raj", createdAt: "x", updatedAt: "x" } });
    expect(r).toEqual({ url: "/api/peeths/p/notes", method: "POST", json: { id: "n1", text: "hi", addedBy: "Raj" } });
  });
  it("peeth.addItem images → { images: [item] } without client flags", () => {
    const r = requestFor({ type: "peeth.addItem", peethId: "p", kind: "images", item: { ...uploaded, pending: true } });
    expect(r).toEqual({ url: "/api/peeths/p/images", method: "POST", json: { images: [uploaded] } });
  });
  it("peeth.patch / patchItem / create", () => {
    expect(requestFor({ type: "peeth.patch", id: "p", info: { place: "x" } })).toEqual({ url: "/api/peeths/p", method: "PATCH", json: { place: "x" } });
    expect(requestFor({ type: "peeth.patchItem", peethId: "p", kind: "notes", itemId: "n", patch: { text: "t" } })).toEqual({ url: "/api/peeths/p/notes/n", method: "PATCH", json: { text: "t" } });
    const c = requestFor({ type: "peeth.create", peeth: { id: "pid", number: 52, name: "n", place: "", description: "", images: [], links: [], notes: [], createdAt: "x", updatedAt: "x" } });
    expect(c).toEqual({ url: "/api/peeths", method: "POST", json: { id: "pid", number: 52, name: "n", place: "", description: "" } });
  });
  it("image.upload → form POST /api/upload", () => {
    expect(requestFor({ type: "image.upload", imageId: "img1", folder: "ideas", name: "a.webp", entity: "idea:a" })).toEqual({ url: "/api/upload", method: "POST", form: true });
  });
});

describe("resolveUpload", () => {
  it("replaces the placeholder image in a queued idea.create and peeth.addItem", () => {
    const c = entry({ type: "idea.create", idea: idea("a", [placeholder]) });
    const add = entry({ type: "peeth.addItem", peethId: "p", kind: "images", item: placeholder });
    const patch = entry({ type: "idea.patch", id: "b", patch: { addImages: [placeholder] } });
    const other = entry({ type: "idea.delete", id: "z" });
    const out = resolveUpload([c, add, patch, other], uploaded);
    expect(out.map((e) => e.id)).toEqual([c.id, add.id, patch.id]);
    expect((out[0].op as { idea: Idea }).idea.images[0]).toEqual(uploaded);
    expect((out[1].op as { item: ImageItem }).item).toEqual(uploaded);
    expect((out[2].op as { patch: { addImages: ImageItem[] } }).patch.addImages[0]).toEqual(uploaded);
  });
});

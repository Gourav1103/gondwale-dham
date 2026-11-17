import { describe, expect, it } from "vitest";
import type { Idea, IdeaInput, Peeth } from "@/lib/types";
import type { Op, OutboxEntry } from "../ops";
import { applyIdeaListOps, applyIdeaOps, applyPeethListOps, applyPeethOps, compactOnEnqueue, diffIdea } from "../pending";

let seq = 0;
const entry = (op: Op, status: OutboxEntry["status"] = "pending"): OutboxEntry => ({
  id: `e${++seq}`,
  seq,
  createdAt: 1000 + seq,
  op,
  status,
  attempts: 0,
});
const noPreview = () => undefined;

const idea = (over: Partial<Idea> = {}): Idea => ({
  id: "i1",
  title: "Old",
  description: "desc",
  links: [],
  images: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});
const peeth = (over: Partial<Peeth> = {}): Peeth => ({
  id: "p1",
  number: 1,
  name: "हिंगुला",
  place: "",
  description: "",
  images: [],
  links: [],
  notes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("ideas", () => {
  it("idea.create shows a new idea at the top of the list with pending: true and createdAt from the op", () => {
    const fresh = idea({ id: "new1", title: "New", createdAt: "2026-11-17T00:00:00.000Z" });
    const list = applyIdeaListOps([idea()], [entry({ type: "idea.create", idea: fresh })], noPreview)!;
    expect(list.map((i) => i.id)).toEqual(["new1", "i1"]);
    expect(list[0].pending).toBe(true);
    expect(list[0].createdAt).toBe("2026-11-17T00:00:00.000Z");
  });

  it("idea.patch sets title only, keeps other fields, applies addLinks/removeImageIds", () => {
    const base = idea({ images: [{ id: "img1", url: "u", path: "p", createdAt: "x" }] });
    const out = applyIdeaOps(
      base,
      "i1",
      [entry({ type: "idea.patch", id: "i1", patch: { title: "New", addLinks: [{ id: "l1", url: "https://a.b", createdAt: "x" }], removeImageIds: ["img1"] } })],
      noPreview,
    )!;
    expect(out.title).toBe("New");
    expect(out.description).toBe("desc");
    expect(out.links.map((l) => l.id)).toEqual(["l1"]);
    expect(out.images).toEqual([]);
    expect(out.pending).toBe(true);
  });

  it("idea.delete removes it from list and applyIdeaOps returns undefined", () => {
    const ops = [entry({ type: "idea.delete", id: "i1" })];
    expect(applyIdeaListOps([idea()], ops, noPreview)).toEqual([]);
    expect(applyIdeaOps(idea(), "i1", ops, noPreview)).toBeUndefined();
  });

  it("ops for other ideas do not touch this one", () => {
    const base = idea();
    expect(applyIdeaOps(base, "i1", [entry({ type: "idea.delete", id: "other" })], noPreview)).toBe(base);
  });
});

describe("peeths", () => {
  it("peeth.addItem images uses preview(imageId) as url and marks pending; failed entry marks failed: true", () => {
    const img = { id: "img9", url: "", path: "", createdAt: "x", pending: true };
    const preview = (id: string) => (id === "img9" ? "blob:local/9" : undefined);
    const ok = applyPeethOps(peeth(), "p1", [entry({ type: "peeth.addItem", peethId: "p1", kind: "images", item: img })], preview)!;
    expect(ok.images[0].url).toBe("blob:local/9");
    expect(ok.images[0].pending).toBe(true);
    const bad = applyPeethOps(peeth(), "p1", [entry({ type: "peeth.addItem", peethId: "p1", kind: "images", item: img }, "failed")], preview)!;
    expect(bad.images[0].failed).toBe(true);
  });

  it("peeth.patchItem on notes changes text; peeth.deleteItem removes the item", () => {
    const base = peeth({
      notes: [{ id: "n1", text: "a", createdAt: "x", updatedAt: "x" }],
      links: [{ id: "l1", url: "https://a.b", createdAt: "x" }],
    });
    const out = applyPeethOps(
      base,
      "p1",
      [
        entry({ type: "peeth.patchItem", peethId: "p1", kind: "notes", itemId: "n1", patch: { text: "b" } }),
        entry({ type: "peeth.deleteItem", peethId: "p1", kind: "links", itemId: "l1" }),
      ],
      noPreview,
    )!;
    expect(out.notes[0].text).toBe("b");
    expect(out.links).toEqual([]);
  });

  it("applyPeethListOps keeps list sorted by number after peeth.create", () => {
    const list = applyPeethListOps([peeth({ id: "a", number: 1 }), peeth({ id: "c", number: 3 })], [entry({ type: "peeth.create", peeth: peeth({ id: "b", number: 2 }) })], noPreview)!;
    expect(list.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("server copy that already contains the item (confirmed) is not duplicated by a still-queued addItem", () => {
    const note = { id: "n1", text: "hi", createdAt: "x", updatedAt: "x" };
    const out = applyPeethOps(peeth({ notes: [note] }), "p1", [entry({ type: "peeth.addItem", peethId: "p1", kind: "notes", item: note })], noPreview)!;
    expect(out.notes).toHaveLength(1);
  });

  it("peeth.patch updates info; peeth.delete hides it", () => {
    const patched = applyPeethOps(peeth(), "p1", [entry({ type: "peeth.patch", id: "p1", info: { place: "असम" } })], noPreview)!;
    expect(patched.place).toBe("असम");
    expect(applyPeethListOps([peeth()], [entry({ type: "peeth.delete", id: "p1" })], noPreview)).toEqual([]);
  });
});

describe("diffIdea", () => {
  const base = idea({
    links: [{ id: "l1", url: "https://a.b", createdAt: "x" }, { id: "l2", url: "https://c.d", createdAt: "x" }],
    images: [{ id: "img1", url: "u", path: "p", createdAt: "x" }],
  });
  const input = (over: Partial<IdeaInput> = {}): IdeaInput => ({
    title: base.title,
    description: base.description,
    links: base.links,
    images: base.images,
    ...over,
  });

  it("returns null when nothing changed", () => {
    expect(diffIdea(base, input())).toBeNull();
  });

  it("returns { title } only when only title changed", () => {
    expect(diffIdea(base, input({ title: "New" }))).toEqual({ title: "New" });
  });

  it("detects added/removed/updated links and added/removed images by id", () => {
    const patch = diffIdea(
      base,
      input({
        links: [{ id: "l1", url: "https://changed.example", createdAt: "x" }, { id: "l3", url: "https://e.f", createdAt: "x" }],
        images: [{ id: "img2", url: "", path: "", createdAt: "x" }],
      }),
    )!;
    expect(patch.updateLinks?.map((l) => l.id)).toEqual(["l1"]);
    expect(patch.addLinks?.map((l) => l.id)).toEqual(["l3"]);
    expect(patch.removeLinkIds).toEqual(["l2"]);
    expect(patch.addImages?.map((i) => i.id)).toEqual(["img2"]);
    expect(patch.removeImageIds).toEqual(["img1"]);
    expect(patch.title).toBeUndefined();
  });
});

describe("compactOnEnqueue", () => {
  it('delete of an idea whose idea.create is still "pending" (not "syncing") → drop every entry for that entity, enqueue: false', () => {
    const q = [entry({ type: "idea.create", idea: idea({ id: "x" }) }), entry({ type: "idea.patch", id: "x", patch: { title: "y" } })];
    expect(compactOnEnqueue(q, { type: "idea.delete", id: "x" })).toEqual({ drop: q.map((e) => e.id), enqueue: false });
  });

  it("delete of an image whose image.upload + addItem are still pending → drop both, enqueue: false", () => {
    const img = { id: "img5", url: "", path: "", createdAt: "x", pending: true };
    const up = entry({ type: "image.upload", imageId: "img5", folder: "peeths/p1", name: "a.webp", entity: "peeth:p1" });
    const add = entry({ type: "peeth.addItem", peethId: "p1", kind: "images", item: img });
    const other = entry({ type: "peeth.addItem", peethId: "p1", kind: "notes", item: { id: "n", text: "t", createdAt: "x", updatedAt: "x" } });
    expect(compactOnEnqueue([up, add, other], { type: "peeth.deleteItem", peethId: "p1", kind: "images", itemId: "img5" })).toEqual({
      drop: [up.id, add.id],
      enqueue: false,
    });
  });

  it('delete when create is "syncing" → drop nothing, enqueue: true', () => {
    const q = [entry({ type: "idea.create", idea: idea({ id: "x" }) }, "syncing")];
    expect(compactOnEnqueue(q, { type: "idea.delete", id: "x" })).toEqual({ drop: [], enqueue: true });
  });

  it("ordinary ops are just enqueued", () => {
    expect(compactOnEnqueue([], { type: "idea.patch", id: "x", patch: { title: "y" } })).toEqual({ drop: [], enqueue: true });
  });
});

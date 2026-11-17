// Pure functions: lay the not-yet-synced changes (outbox) on top of the last server copy.
// The cache always holds the server's data; what the screen shows is server data + these ops,
// so a background refresh can never "undo" something the user just did.

import type { Idea, IdeaInput, ImageItem, LinkItem, NoteItem, Peeth } from "@/lib/types";
import { entityOf, type IdeaPatch, type ItemKind, type Op, type OutboxEntry } from "./ops";

export type PreviewUrl = (imageId: string) => string | undefined;

type Flags = { pending: true; failed?: true };
const flags = (e: OutboxEntry): Flags => (e.status === "failed" ? { pending: true, failed: true } : { pending: true });

function withPreview<T extends ImageItem | LinkItem | NoteItem>(item: T, preview: PreviewUrl): T {
  if ("path" in item && !item.url) return { ...item, url: preview(item.id) ?? "" };
  return item;
}

/** Add items whose id is not there yet (a confirmed item is never duplicated). */
function addMissing<T extends { id: string }>(list: T[], items: T[]): T[] {
  const have = new Set(list.map((x) => x.id));
  const fresh = items.filter((x) => !have.has(x.id));
  return fresh.length ? [...list, ...fresh] : list;
}

// ---------------- Ideas ----------------

function patchIdea(idea: Idea, patch: IdeaPatch, e: OutboxEntry, preview: PreviewUrl): Idea {
  const f = flags(e);
  const removeLinks = new Set(patch.removeLinkIds ?? []);
  const removeImages = new Set(patch.removeImageIds ?? []);
  const updates = new Map((patch.updateLinks ?? []).map((l) => [l.id, l]));
  const links = addMissing(
    idea.links.filter((l) => !removeLinks.has(l.id)).map((l) => (updates.has(l.id) ? { ...l, ...updates.get(l.id)!, ...f } : l)),
    (patch.addLinks ?? []).map((l) => ({ ...l, ...f })),
  );
  const images = addMissing(
    idea.images.filter((i) => !removeImages.has(i.id)),
    (patch.addImages ?? []).map((i) => ({ ...withPreview(i, preview), ...f })),
  );
  return {
    ...idea,
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.description !== undefined && { description: patch.description }),
    links,
    images,
    ...f,
  };
}

function ideaReducer(idea: Idea | undefined, id: string, e: OutboxEntry, preview: PreviewUrl): Idea | undefined {
  const op = e.op;
  if (entityOf(op) !== `idea:${id}`) return idea;
  switch (op.type) {
    case "idea.create":
      // Once the server has it, the server copy wins.
      return idea ?? { ...op.idea, images: op.idea.images.map((i) => withPreview(i, preview)), ...flags(e) };
    case "idea.patch":
      return idea && patchIdea(idea, op.patch, e, preview);
    case "idea.delete":
      return undefined;
    default:
      return idea;
  }
}

export function applyIdeaOps(idea: Idea | undefined, id: string, entries: OutboxEntry[], preview: PreviewUrl): Idea | undefined {
  return entries.reduce<Idea | undefined>((acc, e) => ideaReducer(acc, id, e, preview), idea);
}

const ideaIds = (op: Op): string | undefined =>
  op.type === "idea.create" ? op.idea.id : op.type === "idea.patch" || op.type === "idea.delete" ? op.id : undefined;

export function applyIdeaListOps(list: Idea[] | undefined, entries: OutboxEntry[], preview: PreviewUrl): Idea[] | undefined {
  if (!list) return list;
  const touched = new Set(entries.map((e) => ideaIds(e.op)).filter((x): x is string => !!x));
  if (!touched.size) return list;
  const out = list.map((i) => (touched.has(i.id) ? applyIdeaOps(i, i.id, entries, preview) : i)).filter((i): i is Idea => !!i);
  const known = new Set(list.map((i) => i.id));
  const created = [...touched]
    .filter((id) => !known.has(id))
    .map((id) => applyIdeaOps(undefined, id, entries, preview))
    .filter((i): i is Idea => !!i);
  return [...created.reverse(), ...out]; // newest first, like the server list
}

// ---------------- Peeths ----------------

function peethReducer(p: Peeth | undefined, id: string, e: OutboxEntry, preview: PreviewUrl): Peeth | undefined {
  const op = e.op;
  if (entityOf(op) !== `peeth:${id}`) return p;
  const f = flags(e);
  switch (op.type) {
    case "peeth.create":
      return p ?? { ...op.peeth, ...f };
    case "peeth.patch":
      return p && { ...p, ...op.info, ...f };
    case "peeth.delete":
      return undefined;
    case "peeth.addItem": {
      if (!p) return p;
      const item = { ...withPreview(op.item, preview), ...f };
      return { ...p, [op.kind]: addMissing(p[op.kind] as { id: string }[], [item]) };
    }
    case "peeth.patchItem": {
      if (!p) return p;
      const list = (p[op.kind] as (LinkItem | NoteItem)[]).map((x) => (x.id === op.itemId ? { ...x, ...op.patch, ...f } : x));
      return { ...p, [op.kind]: list };
    }
    case "peeth.deleteItem": {
      if (!p) return p;
      const kind: ItemKind = op.kind;
      return { ...p, [kind]: (p[kind] as { id: string }[]).filter((x) => x.id !== op.itemId) };
    }
    default:
      return p;
  }
}

export function applyPeethOps(p: Peeth | undefined, id: string, entries: OutboxEntry[], preview: PreviewUrl): Peeth | undefined {
  return entries.reduce<Peeth | undefined>((acc, e) => peethReducer(acc, id, e, preview), p);
}

const peethId = (op: Op): string | undefined => {
  const ent = entityOf(op);
  return ent.startsWith("peeth:") && op.type !== "image.upload" ? ent.slice(6) : undefined;
};

export function applyPeethListOps(list: Peeth[] | undefined, entries: OutboxEntry[], preview: PreviewUrl): Peeth[] | undefined {
  if (!list) return list;
  const touched = new Set(entries.map((e) => peethId(e.op)).filter((x): x is string => !!x));
  if (!touched.size) return list;
  const out = list.map((p) => (touched.has(p.id) ? applyPeethOps(p, p.id, entries, preview) : p)).filter((p): p is Peeth => !!p);
  const known = new Set(list.map((p) => p.id));
  for (const id of touched) {
    if (known.has(id)) continue;
    const created = applyPeethOps(undefined, id, entries, preview);
    if (created) out.push(created);
  }
  return out.sort((a, b) => a.number - b.number);
}

// ---------------- Idea form diff ----------------

const sameLink = (a: LinkItem, b: LinkItem) => a.url === b.url && (a.title ?? "") === (b.title ?? "");

export function diffIdea(before: Idea, after: IdeaInput): IdeaPatch | null {
  const patch: IdeaPatch = {};
  if (after.title !== before.title) patch.title = after.title;
  if (after.description !== before.description) patch.description = after.description;

  const oldLinks = new Map(before.links.map((l) => [l.id, l]));
  const newLinkIds = new Set(after.links.map((l) => l.id));
  const addLinks = after.links.filter((l) => !oldLinks.has(l.id));
  const updateLinks = after.links.filter((l) => oldLinks.has(l.id) && !sameLink(oldLinks.get(l.id)!, l));
  const removeLinkIds = before.links.filter((l) => !newLinkIds.has(l.id)).map((l) => l.id);

  const oldImages = new Set(before.images.map((i) => i.id));
  const newImageIds = new Set(after.images.map((i) => i.id));
  const addImages = after.images.filter((i) => !oldImages.has(i.id));
  const removeImageIds = before.images.filter((i) => !newImageIds.has(i.id)).map((i) => i.id);

  if (addLinks.length) patch.addLinks = addLinks;
  if (updateLinks.length) patch.updateLinks = updateLinks;
  if (removeLinkIds.length) patch.removeLinkIds = removeLinkIds;
  if (addImages.length) patch.addImages = addImages;
  if (removeImageIds.length) patch.removeImageIds = removeImageIds;
  return Object.keys(patch).length ? patch : null;
}

// ---------------- Queue compaction ----------------

/**
 * Deleting something that never reached the server cancels its queued ops instead of sending them.
 * Only entries still "pending" can be cancelled — one already "syncing" may have reached the server.
 */
export function compactOnEnqueue(queue: OutboxEntry[], incoming: Op): { drop: string[]; enqueue: boolean } {
  const keep = { drop: [] as string[], enqueue: true };

  if (incoming.type === "idea.delete" || incoming.type === "peeth.delete") {
    const ent = entityOf(incoming);
    const mine = queue.filter((e) => entityOf(e.op) === ent);
    const create = mine.find((e) => e.op.type === "idea.create" || e.op.type === "peeth.create");
    if (create && mine.every((e) => e.status === "pending")) return { drop: mine.map((e) => e.id), enqueue: false };
    return keep;
  }

  if (incoming.type === "peeth.deleteItem") {
    const { peethId, kind, itemId } = incoming;
    const mine = queue.filter(
      (e) =>
        (e.op.type === "image.upload" && e.op.imageId === itemId) ||
        (e.op.type === "peeth.addItem" && e.op.peethId === peethId && e.op.kind === kind && e.op.item.id === itemId) ||
        (e.op.type === "peeth.patchItem" && e.op.peethId === peethId && e.op.itemId === itemId),
    );
    const added = mine.some((e) => e.op.type === "peeth.addItem");
    if (added && mine.every((e) => e.status === "pending")) return { drop: mine.map((e) => e.id), enqueue: false };
  }
  return keep;
}

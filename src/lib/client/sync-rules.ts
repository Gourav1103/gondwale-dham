// Pure rules for the background sync: what a server answer means, when to try again,
// which queued change goes next, and which API call each change becomes.

import type { ImageItem, LinkItem, NoteItem } from "@/lib/types";
import { entityOf, type Op, type OutboxEntry } from "./ops";

export type Outcome = "done" | "retry" | "drop-entity" | "auth" | "failed";

const isDelete = (op: Op) => op.type === "idea.delete" || op.type === "peeth.delete" || op.type === "peeth.deleteItem";

export function classify(op: Op, status: number): Outcome {
  if (status >= 200 && status < 300) return "done";
  if (status === 0 || status >= 500 || status === 429 || status === 408) return "retry";
  if (status === 401) return "auth";
  if (status === 404) return isDelete(op) ? "done" : "drop-entity";
  return "failed";
}

export const backoffMs = (attempts: number) => Math.min(2000 * 2 ** (attempts - 1), 60_000);

/** Lowest-seq entry that may run now. Each entity runs strictly in order. */
export function nextRunnable(queue: OutboxEntry[], now: number): OutboxEntry | undefined {
  const blocked = new Set<string>();
  for (const e of [...queue].sort((a, b) => a.seq - b.seq)) {
    const ent = entityOf(e.op);
    if (blocked.has(ent)) continue;
    if (e.status === "pending" && (e.nextTryAt ?? 0) <= now) return e;
    blocked.add(ent); // failed, syncing or waiting to retry → later ones of this entity wait
  }
  return undefined;
}

export type Req = { url: string; method: string; json?: unknown; form?: true };

/** Strip client-only flags before sending. */
function clean<T extends ImageItem | LinkItem | NoteItem>(item: T): T {
  const { pending: _p, failed: _f, ...rest } = item;
  void _p;
  void _f;
  return rest as T;
}

export function requestFor(op: Op): Req {
  switch (op.type) {
    case "idea.create": {
      const { id, title, description, links, images, addedBy } = op.idea;
      return { url: "/api/ideas", method: "POST", json: { id, title, description, links: links.map(clean), images: images.map(clean), addedBy } };
    }
    case "idea.patch": {
      const p = op.patch;
      const json = {
        ...p,
        ...(p.addLinks && { addLinks: p.addLinks.map(clean) }),
        ...(p.updateLinks && { updateLinks: p.updateLinks.map(clean) }),
        ...(p.addImages && { addImages: p.addImages.map(clean) }),
      };
      return { url: `/api/ideas/${op.id}`, method: "PATCH", json };
    }
    case "idea.delete":
      return { url: `/api/ideas/${op.id}`, method: "DELETE" };
    case "peeth.create": {
      const { id, number, name, place, description } = op.peeth;
      return { url: "/api/peeths", method: "POST", json: { id, number, name, place, description } };
    }
    case "peeth.patch":
      return { url: `/api/peeths/${op.id}`, method: "PATCH", json: op.info };
    case "peeth.delete":
      return { url: `/api/peeths/${op.id}`, method: "DELETE" };
    case "peeth.addItem": {
      const url = `/api/peeths/${op.peethId}/${op.kind}`;
      if (op.kind === "images") return { url, method: "POST", json: { images: [clean(op.item as ImageItem)] } };
      if (op.kind === "links") {
        const { id, url: href, title, addedBy } = op.item as LinkItem;
        return { url, method: "POST", json: { id, url: href, title, addedBy } };
      }
      const { id, text, addedBy } = op.item as NoteItem;
      return { url, method: "POST", json: { id, text, addedBy } };
    }
    case "peeth.patchItem":
      return { url: `/api/peeths/${op.peethId}/${op.kind}/${op.itemId}`, method: "PATCH", json: op.patch };
    case "peeth.deleteItem":
      return { url: `/api/peeths/${op.peethId}/${op.kind}/${op.itemId}`, method: "DELETE" };
    case "image.upload":
      return { url: "/api/upload", method: "POST", form: true };
  }
}

/** After a photo uploads, put its real URL/path/sha into the queued ops that attach it. */
export function resolveUpload(queue: OutboxEntry[], uploaded: ImageItem): OutboxEntry[] {
  const swap = (list: ImageItem[]) => list.map((i) => (i.id === uploaded.id ? uploaded : i));
  const has = (list?: ImageItem[]) => !!list?.some((i) => i.id === uploaded.id);
  const out: OutboxEntry[] = [];
  for (const e of queue) {
    const op = e.op;
    if (op.type === "idea.create" && has(op.idea.images)) {
      out.push({ ...e, op: { ...op, idea: { ...op.idea, images: swap(op.idea.images) } } });
    } else if (op.type === "idea.patch" && has(op.patch.addImages)) {
      out.push({ ...e, op: { ...op, patch: { ...op.patch, addImages: swap(op.patch.addImages!) } } });
    } else if (op.type === "peeth.addItem" && op.kind === "images" && op.item.id === uploaded.id) {
      out.push({ ...e, op: { ...op, item: uploaded } });
    }
  }
  return out;
}

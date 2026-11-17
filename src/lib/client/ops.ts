// A change the user made that still has to reach the server.
// Each Op maps to exactly one API call (see sync-rules.ts → requestFor).

import type { Idea, ImageItem, LinkItem, NoteItem, Peeth } from "@/lib/types";

export type ItemKind = "images" | "links" | "notes";

/** Only what changed in an idea (sent to PATCH /api/ideas/:id). */
export type IdeaPatch = {
  title?: string;
  description?: string;
  addLinks?: LinkItem[];
  updateLinks?: LinkItem[];
  removeLinkIds?: string[];
  addImages?: ImageItem[];
  removeImageIds?: string[];
};

export type PeethInfo = { number?: number; name?: string; place?: string; description?: string };

export type Op =
  | { type: "idea.create"; idea: Idea }
  | { type: "idea.patch"; id: string; patch: IdeaPatch }
  | { type: "idea.delete"; id: string }
  | { type: "peeth.create"; peeth: Peeth }
  | { type: "peeth.patch"; id: string; info: PeethInfo }
  | { type: "peeth.delete"; id: string }
  | { type: "peeth.addItem"; peethId: string; kind: ItemKind; item: ImageItem | LinkItem | NoteItem }
  | { type: "peeth.patchItem"; peethId: string; kind: "links" | "notes"; itemId: string; patch: { url?: string; title?: string; text?: string } }
  | { type: "peeth.deleteItem"; peethId: string; kind: ItemKind; itemId: string }
  | { type: "image.upload"; imageId: string; folder: string; name: string; addedBy?: string; entity: string };

export type OutboxEntry = {
  id: string;
  seq: number;
  createdAt: number;
  op: Op;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  lastError?: string;
  nextTryAt?: number;
};

/** The record an op belongs to. Ops of one entity always run in order. */
export function entityOf(op: Op): string {
  switch (op.type) {
    case "idea.create":
      return `idea:${op.idea.id}`;
    case "idea.patch":
    case "idea.delete":
      return `idea:${op.id}`;
    case "peeth.create":
      return `peeth:${op.peeth.id}`;
    case "peeth.patch":
    case "peeth.delete":
      return `peeth:${op.id}`;
    case "peeth.addItem":
    case "peeth.patchItem":
    case "peeth.deleteItem":
      return `peeth:${op.peethId}`;
    case "image.upload":
      return op.entity;
  }
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** MongoDB-compatible id made on the device: 8 hex of unix seconds + 16 random hex. */
export function newObjectId(): string {
  const time = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  return time + hex(crypto.getRandomValues(new Uint8Array(8)));
}

export const newId = (): string => crypto.randomUUID();

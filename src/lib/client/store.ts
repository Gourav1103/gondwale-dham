"use client";

// Writes the server's answer into the read cache so every page updates at once.
// Shared by the data layer and the background sync.

import { getCached, removeCache, removeFromList, revalidate, setCache, upsertInList } from "./cache";
import type { Idea, Peeth } from "@/lib/types";

export const IDEAS = "ideas";
export const PEETHS = "peeths";
export const ideaKey = (id: string) => `idea:${id}`;
export const peethKey = (id: string) => `peeth:${id}`;

export function storeIdea(idea: Idea) {
  setCache(ideaKey(idea.id), idea);
  upsertInList(IDEAS, idea, "start");
  return idea;
}

export function forgetIdea(id: string) {
  removeCache(ideaKey(id));
  removeFromList(IDEAS, id);
}

export function storePeeth(peeth: Peeth) {
  setCache(peethKey(peeth.id), peeth);
  const list = getCached<Peeth[]>(PEETHS);
  if (list) {
    const next = list.some((p) => p.id === peeth.id) ? list.map((p) => (p.id === peeth.id ? peeth : p)) : [...list, peeth];
    setCache(PEETHS, next.sort((a, b) => a.number - b.number));
  }
  return peeth;
}

export function forgetPeeth(id: string) {
  removeCache(peethKey(id));
  removeFromList(PEETHS, id);
}

/** Re-read an entity ("idea:<id>" | "peeth:<id>") and its list from the server. */
export function refreshEntity(entity: string) {
  const [kind, id] = entity.split(":");
  if (kind === "idea") {
    revalidate(ideaKey(id), `/api/ideas/${id}`).catch(() => {});
    revalidate(IDEAS, "/api/ideas").catch(() => {});
  } else if (kind === "peeth") {
    revalidate(peethKey(id), `/api/peeths/${id}`).catch(() => {});
    revalidate(PEETHS, "/api/peeths").catch(() => {});
  }
}

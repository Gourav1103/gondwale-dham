"use client";

// All reading/writing of ideas and Shakti Peeths goes through here.
// Every change calls the API, then puts the server's answer into the cache,
// so lists and detail pages update everywhere at once.

import { apiFetch } from "./api";
import { getCached, removeCache, removeFromList, setCache, upsertInList, useResource } from "./cache";
import type { Idea, IdeaInput, ImageItem, Peeth } from "@/lib/types";

const IDEAS = "ideas";
const PEETHS = "peeths";
const ideaKey = (id: string) => `idea:${id}`;
const peethKey = (id: string) => `peeth:${id}`;

// ---------------- Ideas ----------------

export const useIdeas = () => useResource<Idea[]>(IDEAS, "/api/ideas");

export const useIdea = (id: string) =>
  useResource<Idea>(ideaKey(id), `/api/ideas/${id}`, {
    placeholder: () => getCached<Idea[]>(IDEAS)?.find((i) => i.id === id),
  });

function storeIdea(idea: Idea) {
  setCache(ideaKey(idea.id), idea);
  upsertInList(IDEAS, idea, "start");
}

export async function createIdea(input: IdeaInput) {
  const idea = await apiFetch<Idea>("/api/ideas", { method: "POST", json: input });
  storeIdea(idea);
  return idea;
}

export async function updateIdea(id: string, input: IdeaInput) {
  const idea = await apiFetch<Idea>(`/api/ideas/${id}`, { method: "PUT", json: input });
  storeIdea(idea);
  return idea;
}

export async function deleteIdea(id: string) {
  await apiFetch(`/api/ideas/${id}`, { method: "DELETE" });
  removeCache(ideaKey(id));
  removeFromList(IDEAS, id);
}

// ---------------- Shakti Peeths ----------------

export const usePeeths = () => useResource<Peeth[]>(PEETHS, "/api/peeths");

export const usePeeth = (id: string) =>
  useResource<Peeth>(peethKey(id), `/api/peeths/${id}`, {
    placeholder: () => getCached<Peeth[]>(PEETHS)?.find((p) => p.id === id),
  });

function storePeeth(peeth: Peeth) {
  setCache(peethKey(peeth.id), peeth);
  const list = getCached<Peeth[]>(PEETHS);
  if (list) {
    const next = list.some((p) => p.id === peeth.id) ? list.map((p) => (p.id === peeth.id ? peeth : p)) : [...list, peeth];
    setCache(PEETHS, next.sort((a, b) => a.number - b.number));
  }
  return peeth;
}

export const createPeeth = async (input: { number?: number; name: string; place: string; description: string }) =>
  storePeeth(await apiFetch<Peeth>("/api/peeths", { method: "POST", json: input }));

export const updatePeethInfo = async (id: string, input: Partial<Pick<Peeth, "number" | "name" | "place" | "description">>) =>
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}`, { method: "PATCH", json: input }));

export async function deletePeeth(id: string) {
  await apiFetch(`/api/peeths/${id}`, { method: "DELETE" });
  removeCache(peethKey(id));
  removeFromList(PEETHS, id);
}

export const addPeethImages = async (id: string, images: ImageItem[]) =>
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/images`, { method: "POST", json: { images } }));

export const addPeethLink = async (id: string, link: { url: string; title?: string; addedBy?: string }) =>
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/links`, { method: "POST", json: link }));

export const addPeethNote = async (id: string, note: { text: string; addedBy?: string }) =>
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/notes`, { method: "POST", json: note }));

export const updatePeethItem = async (
  id: string,
  kind: "links" | "notes",
  itemId: string,
  patch: { url?: string; title?: string; text?: string },
) => storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/${kind}/${itemId}`, { method: "PATCH", json: patch }));

export const deletePeethItem = async (id: string, kind: "images" | "links" | "notes", itemId: string) =>
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/${kind}/${itemId}`, { method: "DELETE" }));

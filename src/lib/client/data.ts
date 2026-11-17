"use client";

// All reading/writing of ideas and Shakti Peeths goes through here.
//
// Writes are offline-first: each change is saved on this device (outbox) and shown at once;
// the background sync (sync.ts) sends it to the server. If this browser can't save on the
// device (no IndexedDB, storage full), the change goes straight to the server instead and
// the caller waits, exactly as before.
//
// Reads show the last server copy (cache.ts) with the not-yet-sent changes laid on top.

import { useMemo } from "react";
import { apiFetch } from "./api";
import { getCached, useResource } from "./cache";
import { compressImage, uploadImage, validateImage } from "./images";
import { newId, newObjectId, type ItemKind, type Op, type PeethInfo } from "./ops";
import { enqueue, isPersistent, loadOutbox, previewUrl, useOutbox } from "./outbox";
import { applyIdeaListOps, applyIdeaOps, applyPeethListOps, applyPeethOps, diffIdea } from "./pending";
import { IDEAS, PEETHS, forgetIdea, forgetPeeth, ideaKey, peethKey, storeIdea, storePeeth } from "./store";
import { kick } from "./sync";
import type { Idea, IdeaInput, ImageItem, LinkItem, NoteItem, Peeth } from "@/lib/types";

/** A photo picked in a form, not uploaded yet. `id` is also the placeholder image's id. */
export type NewPhoto = { id: string; file: File };

// ---------------- Offline-saving availability ----------------

const fallbackListeners = new Set<() => void>();
let fallbackNoticeShown = false;

/** Called once when this browser can't save changes on the device. */
export function onOfflineUnavailable(fn: () => void) {
  fallbackListeners.add(fn);
  return () => {
    fallbackListeners.delete(fn);
  };
}

async function canQueue() {
  await loadOutbox();
  if (isPersistent()) return true;
  if (!fallbackNoticeShown) {
    fallbackNoticeShown = true;
    fallbackListeners.forEach((fn) => fn());
  }
  return false;
}

/** Queue ops in order; false if any could not be saved (caller falls back). */
async function queue(ops: { op: Op; blob?: { imageId: string; file: Blob } }[]) {
  for (const { op, blob } of ops) {
    if (!(await enqueue(op, blob))) return false;
  }
  kick();
  return true;
}

const now = () => new Date().toISOString();

function placeholder(photo: NewPhoto, addedBy?: string): ImageItem {
  return { id: photo.id, url: "", path: "", name: photo.file.name, addedBy, createdAt: now(), pending: true };
}

/** Compress + validate photos and build their upload ops. Throws the first validation error. */
async function photoUploads(photos: NewPhoto[], folder: string, entity: string, addedBy?: string) {
  const out: { op: Op; blob: { imageId: string; file: Blob } }[] = [];
  for (const p of photos) {
    const ready = await compressImage(p.file);
    const problem = validateImage(ready);
    if (problem) throw new Error(problem);
    out.push({
      op: { type: "image.upload", imageId: p.id, folder, name: ready.name, addedBy, entity },
      blob: { imageId: p.id, file: ready },
    });
  }
  return out;
}

/** Direct (no device storage) path: upload photos now and swap them in for their placeholders. */
async function uploadNow(images: ImageItem[], photos: NewPhoto[], folder: string, addedBy?: string) {
  const byId = new Map(photos.map((p) => [p.id, p.file]));
  const out: ImageItem[] = [];
  for (const img of images) {
    const file = byId.get(img.id);
    out.push(file ? await uploadImage(file, folder, addedBy) : img);
  }
  return out;
}

const stripFlags = <T extends { pending?: boolean; failed?: boolean }>(x: T): T => {
  const { pending: _p, failed: _f, ...rest } = x;
  void _p;
  void _f;
  return rest as T;
};

// ---------------- Ideas ----------------

export function useIdeas() {
  const res = useResource<Idea[]>(IDEAS, "/api/ideas");
  const q = useOutbox();
  const data = useMemo(() => applyIdeaListOps(res.data, q, previewUrl), [res.data, q]);
  return { ...res, data };
}

export function useIdea(id: string) {
  const res = useResource<Idea>(ideaKey(id), `/api/ideas/${id}`, {
    placeholder: () => getCached<Idea[]>(IDEAS)?.find((i) => i.id === id),
  });
  const q = useOutbox();
  const data = useMemo(() => applyIdeaOps(res.data, id, q, previewUrl), [res.data, id, q]);
  // Made on this device and not on the server yet → the server's 404 is expected.
  const local = q.some((e) => e.op.type === "idea.create" && e.op.idea.id === id);
  const error = local ? undefined : res.error;
  return { ...res, data, error, isLoading: data === undefined && !error && !local && res.isLoading };
}

export async function createIdea(input: IdeaInput, photos: NewPhoto[] = []): Promise<Idea> {
  const id = newObjectId();
  const at = now();
  const idea: Idea = { ...input, id, links: input.links.map(stripFlags), createdAt: at, updatedAt: at };

  if (await canQueue()) {
    const uploads = await photoUploads(photos, "ideas", `idea:${id}`, input.addedBy);
    if (await queue([...uploads, { op: { type: "idea.create", idea } }])) return { ...idea, pending: true };
  }
  const images = await uploadNow(input.images, photos, "ideas", input.addedBy);
  return storeIdea(await apiFetch<Idea>("/api/ideas", { method: "POST", json: { ...input, images: images.map(stripFlags) } }));
}

export async function updateIdea(before: Idea, input: IdeaInput, photos: NewPhoto[] = []): Promise<Idea> {
  const patch = diffIdea(before, input);
  if (!patch) return before;

  if (await canQueue()) {
    const uploads = await photoUploads(photos, "ideas", `idea:${before.id}`, input.addedBy);
    if (await queue([...uploads, { op: { type: "idea.patch", id: before.id, patch } }])) {
      return { ...before, ...input, updatedAt: now(), pending: true };
    }
  }
  const images = await uploadNow(input.images, photos, "ideas", input.addedBy);
  const direct = diffIdea(before, { ...input, images })!;
  return storeIdea(await apiFetch<Idea>(`/api/ideas/${before.id}`, { method: "PATCH", json: direct }));
}

export async function deleteIdea(id: string) {
  if ((await canQueue()) && (await queue([{ op: { type: "idea.delete", id } }]))) return;
  await apiFetch(`/api/ideas/${id}`, { method: "DELETE" });
  forgetIdea(id);
}

// ---------------- Shakti Peeths ----------------

export function usePeeths() {
  const res = useResource<Peeth[]>(PEETHS, "/api/peeths");
  const q = useOutbox();
  const data = useMemo(() => applyPeethListOps(res.data, q, previewUrl), [res.data, q]);
  return { ...res, data };
}

export function usePeeth(id: string) {
  const res = useResource<Peeth>(peethKey(id), `/api/peeths/${id}`, {
    placeholder: () => getCached<Peeth[]>(PEETHS)?.find((p) => p.id === id),
  });
  const q = useOutbox();
  const data = useMemo(() => applyPeethOps(res.data, id, q, previewUrl), [res.data, id, q]);
  const local = q.some((e) => e.op.type === "peeth.create" && e.op.peeth.id === id);
  const error = local ? undefined : res.error;
  return { ...res, data, error, isLoading: data === undefined && !error && !local && res.isLoading };
}

type PeethInput = { number?: number; name: string; place: string; description: string };

export async function createPeeth(input: PeethInput): Promise<Peeth> {
  if (await canQueue()) {
    const list = getCached<Peeth[]>(PEETHS) ?? [];
    const number = input.number ?? Math.max(0, ...list.map((p) => p.number)) + 1;
    const at = now();
    const peeth: Peeth = { ...input, number, id: newObjectId(), images: [], links: [], notes: [], createdAt: at, updatedAt: at };
    if (await queue([{ op: { type: "peeth.create", peeth } }])) return { ...peeth, pending: true };
  }
  return storePeeth(await apiFetch<Peeth>("/api/peeths", { method: "POST", json: input }));
}

export async function updatePeethInfo(id: string, info: PeethInfo): Promise<Peeth> {
  if ((await canQueue()) && (await queue([{ op: { type: "peeth.patch", id, info } }]))) {
    const current = getCached<Peeth>(peethKey(id)) ?? getCached<Peeth[]>(PEETHS)?.find((p) => p.id === id);
    return { ...(current as Peeth), ...info, pending: true };
  }
  return storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}`, { method: "PATCH", json: info }));
}

export async function deletePeeth(id: string) {
  if ((await canQueue()) && (await queue([{ op: { type: "peeth.delete", id } }]))) return;
  await apiFetch(`/api/peeths/${id}`, { method: "DELETE" });
  forgetPeeth(id);
}

/** Save picked photos for a Shakti Peeth. Bad files are skipped and reported in `errors`. */
export async function addPeethPhotos(peeth: Peeth, files: File[], addedBy?: string): Promise<{ added: number; errors: string[] }> {
  const folder = `peeths/${peeth.id}`;
  const errors: string[] = [];
  let added = 0;
  const direct = !(await canQueue());

  for (const file of files) {
    const photo: NewPhoto = { id: newId(), file };
    try {
      if (!direct) {
        const uploads = await photoUploads([photo], folder, `peeth:${peeth.id}`, addedBy);
        const item = { ...placeholder(photo, addedBy), name: uploads[0].op.type === "image.upload" ? uploads[0].op.name : file.name };
        if (await queue([...uploads, { op: { type: "peeth.addItem", peethId: peeth.id, kind: "images", item } }])) {
          added++;
          continue;
        }
      }
      const image = await uploadImage(file, folder, addedBy);
      storePeeth(await apiFetch<Peeth>(`/api/peeths/${peeth.id}/images`, { method: "POST", json: { images: [image] } }));
      added++;
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  return { added, errors };
}

/** Same rule as the server: links without a scheme get https://. */
function normaliseUrl(url: string) {
  const v = url.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

export async function addPeethLink(id: string, link: { url: string; title?: string; addedBy?: string }) {
  const item: LinkItem = { id: newId(), url: normaliseUrl(link.url), title: link.title?.trim() || undefined, addedBy: link.addedBy, createdAt: now() };
  if ((await canQueue()) && (await queue([{ op: { type: "peeth.addItem", peethId: id, kind: "links", item } }]))) return;
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/links`, { method: "POST", json: link }));
}

export async function addPeethNote(id: string, note: { text: string; addedBy?: string }) {
  const at = now();
  const item: NoteItem = { id: newId(), text: note.text.trim(), addedBy: note.addedBy, createdAt: at, updatedAt: at };
  if ((await canQueue()) && (await queue([{ op: { type: "peeth.addItem", peethId: id, kind: "notes", item } }]))) return;
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/notes`, { method: "POST", json: note }));
}

export async function updatePeethItem(id: string, kind: "links" | "notes", itemId: string, patch: { url?: string; title?: string; text?: string }) {
  const clean = { ...patch, ...(patch.url !== undefined && { url: normaliseUrl(patch.url) }) };
  if ((await canQueue()) && (await queue([{ op: { type: "peeth.patchItem", peethId: id, kind, itemId, patch: clean } }]))) return;
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/${kind}/${itemId}`, { method: "PATCH", json: patch }));
}

export async function deletePeethItem(id: string, kind: ItemKind, itemId: string) {
  if ((await canQueue()) && (await queue([{ op: { type: "peeth.deleteItem", peethId: id, kind, itemId } }]))) return;
  storePeeth(await apiFetch<Peeth>(`/api/peeths/${id}/${kind}/${itemId}`, { method: "DELETE" }));
}

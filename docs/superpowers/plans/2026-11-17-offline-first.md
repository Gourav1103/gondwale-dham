# Offline-first changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every create/edit/delete shows on screen instantly, is saved on the device (IndexedDB outbox) and synced to the server in the background, safely retried, never silently lost.

**Architecture:** A persistent outbox of typed ops lives in IndexedDB next to the existing read cache. Hooks show `applyPending(serverCopy, outbox)`, so background refreshes never undo pending work. One sync runner per browser (Web Locks) sends ops in FIFO order; the server is made idempotent with client-generated ids so retries never duplicate.

**Tech Stack:** Next.js 16 / React 19, TypeScript, MongoDB driver 7, IndexedDB, Vitest + fake-indexeddb (new, dev only).

**Spec:** [docs/superpowers/specs/2026-11-17-offline-first-design.md](../specs/2026-11-17-offline-first-design.md)

## Global Constraints

- First load still needs internet; no service worker (spec non-goal).
- Ops run strictly in `seq` order, one at a time.
- Backoff: 2s, 4s, 8s … capped at 60s; immediate retry on `online`, tab focus, user Retry.
- 401 during background sync: pause, keep queue, no auto-redirect.
- 404 on target: drop op + later ops for the same entity, toast "This was deleted by someone else, so your change could not be saved." (404 on a *delete* op = success.)
- Other 4xx: mark `failed`, block only later ops of the same entity.
- IndexedDB unavailable / quota error → that action calls the server directly (today's behaviour) + one-time notice "This browser can't save changes offline."
- Keep `PUT /api/ideas/:id` working (old clients) alongside the new `PATCH`.
- User-facing copy in English, matching existing toasts.

## Review Focus

1. Photo picked, page reloaded before it uploaded → tile still shows (from stored blob) and upload completes after reload. (Test in Task 4 + manual check in Task 9.)
2. Something created offline and then deleted before it synced → no server calls at all for it, no error toast. (Test in Task 1/`compactOnEnqueue`.)
3. Request succeeded on the server but the response was lost → retry returns the same item, no duplicate idea/note/photo. (Server checks in Task 3.)
4. Login expires while 5 ops are queued → sync pauses, nothing lost, nothing redirects; after login it resumes. (Test in Task 2 + manual in Task 9.)
5. Two tabs open → only one sends; the other still shows the same pending state. (Manual in Task 9.)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/client/ops.ts` (new) | `Op` union, `OutboxEntry`, `entityOf`, `newObjectId`, `newId` |
| `src/lib/client/pending.ts` (new) | Pure: `applyIdeaOps`, `applyIdeaListOps`, `applyPeethOps`, `applyPeethListOps`, `diffIdea`, `compactOnEnqueue` |
| `src/lib/client/sync-rules.ts` (new) | Pure: `classify`, `nextRunnable`, `backoffMs`, `requestFor`, `resolveUpload` |
| `src/lib/client/idb.ts` (new) | Shared IndexedDB open (DB `harihaat-cache` **v2**: stores `kv`, `outbox`, `blobs`) |
| `src/lib/client/outbox.ts` (new) | Persistent queue + blobs + preview URLs + cross-tab broadcast + `useOutbox` |
| `src/lib/client/sync.ts` (new) | Runner: lock, triggers, execute, write cache, status store `useSyncStatus` |
| `src/lib/client/cache.ts` | Use `idb.ts`; export `storeIdea`/`storePeeth` helpers' building blocks unchanged |
| `src/lib/client/api.ts` | `noAuthRedirect` option |
| `src/lib/client/data.ts` | Mutations enqueue + return optimistic result; hooks apply pending; direct fallback |
| `src/lib/server/http.ts`, API routes, `storage.ts` | Idempotent creates/pushes, idea `PATCH`, upload with client id |
| `src/components/SyncStatus.tsx` (new) | Header pill + sheet (Retry / Discard) |
| `src/components/images/ImageGrid.tsx` | Show `pending` / `failed` flags on tiles; drop `queue` props |
| `src/components/images/useUploadQueue.ts` | Delete |
| `src/components/views/IdeaForm.tsx`, `PeethDetailView.tsx`, `PeethInfoDialog.tsx`, `IdeasListView.tsx`, `IdeaDetailView.tsx`, `AppShell.tsx` | Call new data API, no waiting |
| `vitest.config.ts`, `src/lib/client/__tests__/*.test.ts` (new) | Tests |

---

### Task 1: Op types and pure "apply pending" layer

**Files:**
- Create: `vitest.config.ts`, `src/lib/client/ops.ts`, `src/lib/client/pending.ts`
- Modify: `package.json` (devDeps `vitest`, `fake-indexeddb`; script `"test": "vitest run"`), `src/lib/types.ts`
- Test: `src/lib/client/__tests__/pending.test.ts`

**Interfaces:**
- Produces (`src/lib/types.ts`): add optional `pending?: boolean; failed?: boolean` to `ImageItem`, `LinkItem`, `NoteItem`, `Idea`, `Peeth`.
- Produces (`ops.ts`):
  ```ts
  type ItemKind = "images" | "links" | "notes";
  type IdeaPatch = { title?: string; description?: string; addLinks?: LinkItem[]; updateLinks?: LinkItem[];
                     removeLinkIds?: string[]; addImages?: ImageItem[]; removeImageIds?: string[] };
  type PeethInfo = { number?: number; name?: string; place?: string; description?: string };
  type Op =
    | { type: "idea.create"; idea: Idea }                       // full optimistic idea, client id
    | { type: "idea.patch"; id: string; patch: IdeaPatch }
    | { type: "idea.delete"; id: string }
    | { type: "peeth.create"; peeth: Peeth }
    | { type: "peeth.patch"; id: string; info: PeethInfo }
    | { type: "peeth.delete"; id: string }
    | { type: "peeth.addItem"; peethId: string; kind: ItemKind; item: ImageItem | LinkItem | NoteItem }
    | { type: "peeth.patchItem"; peethId: string; kind: "links" | "notes"; itemId: string; patch: { url?: string; title?: string; text?: string } }
    | { type: "peeth.deleteItem"; peethId: string; kind: ItemKind; itemId: string }
    | { type: "image.upload"; imageId: string; folder: string; name: string; addedBy?: string; entity: string };
  type OutboxEntry = { id: string; seq: number; createdAt: number; op: Op;
                       status: "pending" | "syncing" | "failed"; attempts: number; lastError?: string; nextTryAt?: number };
  function entityOf(op: Op): string;   // "idea:<id>" | "peeth:<id>"; image.upload → op.entity
  function newObjectId(): string;      // 24 lowercase hex: 8 hex unix-seconds + 16 random hex
  function newId(): string;            // crypto.randomUUID()
  ```
- Produces (`pending.ts`):
  ```ts
  type PreviewUrl = (imageId: string) => string | undefined;
  function applyIdeaOps(idea: Idea | undefined, id: string, entries: OutboxEntry[], preview: PreviewUrl): Idea | undefined;
  function applyIdeaListOps(list: Idea[] | undefined, entries: OutboxEntry[], preview: PreviewUrl): Idea[] | undefined;
  function applyPeethOps(p: Peeth | undefined, id: string, entries: OutboxEntry[], preview: PreviewUrl): Peeth | undefined;
  function applyPeethListOps(list: Peeth[] | undefined, entries: OutboxEntry[], preview: PreviewUrl): Peeth[] | undefined;
  function diffIdea(before: Idea, after: IdeaInput): IdeaPatch | null;   // null = nothing changed
  function compactOnEnqueue(queue: OutboxEntry[], incoming: Op): { drop: string[]; enqueue: boolean };
  ```

- [ ] **Step 1: Add Vitest** — `npm i -D vitest fake-indexeddb`; `vitest.config.ts` with `resolve.alias { "@": "./src" }`, `environment: "node"`; add `"test": "vitest run"`.

- [ ] **Step 2: Write the failing tests** in `pending.test.ts`:
  - `idea.create shows a new idea at the top of the list with pending: true and createdAt from the op`
  - `idea.patch sets title only, keeps other fields, applies addLinks/removeImageIds`
  - `idea.delete removes it from list and applyIdeaOps returns undefined`
  - `peeth.addItem images uses preview(imageId) as url and marks pending; failed entry marks failed: true`
  - `peeth.patchItem on notes changes text; peeth.deleteItem removes the item`
  - `applyPeethListOps keeps list sorted by number after peeth.create`
  - `server copy that already contains the item (confirmed) is not duplicated by a still-queued addItem` (match by item id)
  - `diffIdea returns null when nothing changed; returns { title } only when only title changed; detects added/removed/updated links and added/removed images by id`
  - `compactOnEnqueue: delete of an idea whose idea.create is still "pending" (not "syncing") → drop every entry for that entity, enqueue: false`
  - `compactOnEnqueue: delete of an image whose image.upload + addItem are still pending → drop both, enqueue: false`
  - `compactOnEnqueue: delete when create is "syncing" → drop nothing, enqueue: true`

- [ ] **Step 3: Run** `npm test` → FAIL (modules missing).

- [ ] **Step 4: Implement** `ops.ts` and `pending.ts`. Only entries with status `pending|syncing|failed` are in the queue; all apply. `failed` entries set `failed: true` on the affected item/record.

- [ ] **Step 5: Run** `npm test` → PASS.

- [ ] **Step 6: Commit** `feat(offline): op types and pure pending-apply layer`

---

### Task 2: Pure sync rules

**Files:**
- Create: `src/lib/client/sync-rules.ts`
- Test: `src/lib/client/__tests__/sync-rules.test.ts`

**Interfaces:**
- Consumes: `Op`, `OutboxEntry`, `entityOf` (Task 1).
- Produces:
  ```ts
  type Outcome = "done" | "retry" | "drop-entity" | "auth" | "failed";
  function classify(op: Op, status: number): Outcome;
    // 2xx→done; 0, >=500, 429, 408→retry; 401→auth; 404→ (op is a delete ? "done" : "drop-entity"); other 4xx→failed
  function backoffMs(attempts: number): number;          // min(2000 * 2^(attempts-1), 60000)
  function nextRunnable(queue: OutboxEntry[], now: number): OutboxEntry | undefined;
    // lowest seq with status "pending" and (nextTryAt ?? 0) <= now, whose entity has no earlier
    // entry that is "failed" or waiting for retry (FIFO per entity)
  type Req = { url: string; method: string; json?: unknown; form?: true };
  function requestFor(op: Op): Req;                      // image.upload → { url: "/api/upload", method: "POST", form: true }
  function resolveUpload(queue: OutboxEntry[], uploaded: ImageItem): OutboxEntry[];
    // returns entries whose op references uploaded.id (peeth.addItem images, idea.create images,
    // idea.patch addImages) with the image replaced by `uploaded` (pending flag removed)
  ```

- [ ] **Step 1: Write the failing tests:**
  - `classify` table for: 200, 0, 503, 429, 401, 404 on `peeth.deleteItem` (done), 404 on `idea.patch` (drop-entity), 400 (failed), 413 (failed)
  - `backoffMs(1)=2000, (2)=4000, (3)=8000, (10)=60000`
  - `nextRunnable skips entries with nextTryAt in the future`
  - `nextRunnable: failed entry for idea:A blocks later idea:A entries but not peeth:B`
  - `requestFor` for each op type: `idea.create` → POST `/api/ideas` json includes `id`; `idea.patch` → PATCH `/api/ideas/:id`; `peeth.addItem` notes → POST `/api/peeths/:id/notes` json `{ id, text, addedBy }`; `peeth.addItem` images → json `{ images: [item] }`
  - `resolveUpload replaces the placeholder image in a queued idea.create and peeth.addItem`

- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** `sync-rules.ts`.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(offline): sync rules (classify, backoff, ordering, request mapping)`

---

### Task 3: Idempotent server + idea PATCH + upload with client id

**Files:**
- Modify: `src/lib/server/http.ts`, `src/app/api/ideas/route.ts`, `src/app/api/ideas/[id]/route.ts`, `src/app/api/peeths/route.ts`, `src/app/api/peeths/[id]/[kind]/route.ts`, `src/app/api/upload/route.ts`, `src/lib/server/storage.ts`

**Interfaces:**
- Produces (`http.ts`): `clientObjectId(raw: unknown): ObjectId | null` (valid 24-hex only); `clientUuid(raw: unknown): string | undefined` (`/^[0-9a-f-]{36}$/i`).
- `POST /api/ideas`, `POST /api/peeths`: optional `id`. If a doc with that `_id` exists → return it with 200. Insert with that `_id`; on Mongo duplicate-key (code 11000) → re-read and return 200.
- `POST /api/peeths/:id/:kind`: notes accept `id` (via `clientUuid`, else new). Only push items whose id is absent: filter `{ _id, "<kind>.id": { $nin: ids } }`. If no doc matched, re-read by `_id`: exists → return it (200, already applied); missing → 404.
- `PATCH /api/ideas/:id` body = `IdeaPatch`. `$set` title/description if present (same validation as PUT), `$push` addLinks/addImages (skip ids already present), `$pull` removeLinkIds/removeImageIds, apply updateLinks via positional updates (one `updateOne` per link, or an `arrayFilters` update), then delete GitHub files of removed images (as PUT does). Returns the idea.
- `/api/upload`: accept `id` form field (`clientUuid`) used as the file name; `saveFile` on GitHub 422 "already exists" → GET the file to read its `sha` and return `{ url, path, sha }` instead of throwing.

- [ ] **Step 1: Implement** the changes above.
- [ ] **Step 2: Verify** with dev server running (`npm run dev`), logged-in cookie in `$C`:
  ```bash
  ID=$(node -e "console.log(Math.floor(Date.now()/1000).toString(16)+require('crypto').randomBytes(8).toString('hex'))")
  for i in 1 2; do curl -s -b "$C" -XPOST localhost:3000/api/ideas -H 'content-type: application/json' -d "{\"id\":\"$ID\",\"title\":\"t\"}" -o /dev/null -w "%{http_code}\n"; done
  ```
  Expected: `201` then `200`, and `GET /api/ideas` contains that id exactly once. Repeat the same check for a note POST with a fixed `id` (second call 200, note appears once) and for `PATCH /api/ideas/$ID` `{"title":"new"}` (title changes, description untouched). Clean up with DELETE.
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → no errors.
- [ ] **Step 4: Commit** `feat(api): idempotent creates/pushes, idea PATCH, upload with client id`

---

### Task 4: IndexedDB v2 + persistent outbox

**Files:**
- Create: `src/lib/client/idb.ts`, `src/lib/client/outbox.ts`
- Modify: `src/lib/client/cache.ts` (use `idb.ts`; behaviour unchanged)
- Test: `src/lib/client/__tests__/outbox.test.ts` (uses `import "fake-indexeddb/auto"`)

**Interfaces:**
- Produces (`idb.ts`): `openDb(): Promise<IDBDatabase | null>` (DB `harihaat-cache`, version 2, creates missing stores `kv`, `outbox` keyPath `id`, `blobs`); `tx<T>(store, mode, run): Promise<T | undefined>`.
- Produces (`outbox.ts`):
  ```ts
  function loadOutbox(): Promise<void>;                     // hydrate memory + preview URLs from IDB once
  function isPersistent(): boolean;                         // false if IDB unavailable or a write failed (quota)
  function enqueue(op: Op, blob?: { imageId: string; file: Blob }): Promise<boolean>; // runs compactOnEnqueue; false → caller must fall back
  function getQueue(): OutboxEntry[];                       // sorted by seq
  function updateEntry(id: string, patch: Partial<OutboxEntry>): Promise<void>;
  function replaceEntries(entries: OutboxEntry[]): Promise<void>;
  function removeEntries(ids: string[]): Promise<void>;      // also deletes blobs no longer referenced
  function getBlob(imageId: string): Promise<Blob | undefined>;
  function previewUrl(imageId: string): string | undefined;
  function useOutbox(): OutboxEntry[];                       // useSyncExternalStore
  function subscribeOutbox(fn: () => void): () => void;
  ```
  Cross-tab: `BroadcastChannel("harihaat-outbox")` posts `"changed"`; receivers reload from IDB.

- [ ] **Step 1: Write failing tests:** `enqueue persists and survives a fresh load (reset module, loadOutbox)`; `blob is stored and previewUrl returns a blob: URL after reload` (stub `URL.createObjectURL`); `removeEntries deletes the blob when no entry references it`; `enqueue applies compactOnEnqueue (create+delete of same pending idea leaves queue empty)`; `seq keeps increasing across reloads`.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement.** On any IDB write error set `isPersistent()` false and make `enqueue` resolve `false`.
- [ ] **Step 4: Run** `npm test` → PASS; open the app, confirm existing cached pages still load instantly (cache migration to v2 must keep `kv` data).
- [ ] **Step 5: Commit** `feat(offline): IndexedDB v2 and persistent outbox`

---

### Task 5: Sync runner

**Files:**
- Create: `src/lib/client/sync.ts`
- Modify: `src/lib/client/api.ts` (option `noAuthRedirect?: boolean`)
- Test: `src/lib/client/__tests__/sync.test.ts` (fake-indexeddb + mocked `fetch`)

**Interfaces:**
- Consumes: Task 2 rules, Task 4 outbox, `setCache`/`removeCache`/`upsertInList`/`removeFromList` from `cache.ts`.
- Produces:
  ```ts
  function startSync(): () => void;      // idempotent; registers online/focus/visibility listeners; returns stop
  function kick(): void;                 // run now (called after enqueue and on Retry)
  function retryEntry(id: string): Promise<void>;     // status pending, attempts 0, nextTryAt 0, kick
  function discardEntry(id: string): Promise<void>;   // remove it + later entries of same entity
  type SyncStatus = { state: "idle" | "syncing" | "offline" | "auth" | "failed"; pending: number; failed: number };
  function useSyncStatus(): SyncStatus;
  function onEntityDropped(fn: (entity: string) => void): () => void;  // UI shows the 404 toast
  ```
- Behaviour: run loop inside `navigator.locks.request("harihaat-sync", …)` (if `navigator.locks` missing, just run). Loop: `nextRunnable` → mark `syncing` → for `image.upload` read blob and POST FormData (`file`, `folder`, `addedBy`, `id`) → `classify`:
  - `done`: write response to cache (idea/peeth responses via the same store helpers `data.ts` uses; `image.upload` → `replaceEntries(resolveUpload(...))`), then `removeEntries([entry.id])`.
  - `retry`: `attempts+1`, `nextTryAt = now + backoffMs`, status `pending`, state `offline` when `navigator.onLine === false` or status 0; schedule a timer for the earliest `nextTryAt`.
  - `auth`: state `auth`, status `pending`, stop loop until `kick()` after login.
  - `drop-entity`: remove this and all later entries with the same `entityOf`; emit `onEntityDropped`; `revalidate` the affected cache key.
  - `failed`: status `failed`, `lastError` = server message.
  On startup, entries left in `syncing` (tab closed mid-request) go back to `pending`.

- [ ] **Step 1: Write failing tests:** `sends ops in seq order and empties the queue on 2xx`; `network error schedules retry with backoff and keeps the entry`; `401 sets state auth and does not call window.location`; `404 on idea.patch drops later ops for that idea only`; `image.upload result is substituted into the following peeth.addItem before it is sent`; `entry stuck in syncing at startup is retried`.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(offline): background sync runner`

---

### Task 6: Data layer — enqueue mutations, hooks apply pending

**Files:**
- Modify: `src/lib/client/data.ts`, `src/lib/client/cache.ts` (hook option to ignore 404)
- Modify: `src/lib/client/images.ts` (export `compressImage` unchanged; add `validateImage(file): string | null` — type in the server's `EXT` list and size ≤ 15 MB)

**Interfaces:**
- Consumes: `enqueue`, `isPersistent`, `useOutbox`, `previewUrl` (Task 4); `kick` (Task 5); `applyIdeaOps`… `diffIdea` (Task 1).
- Produces (all mutations return immediately with the optimistic value; when `enqueue` returns `false` they fall back to the current direct `apiFetch` path and `await` it):
  ```ts
  useIdeas(); useIdea(id); usePeeths(); usePeeth(id);              // same return shape as today, data has pending applied
  createIdea(input: IdeaInput, newPhotos: File[]): Promise<Idea>;
  updateIdea(before: Idea, input: IdeaInput, newPhotos: File[]): Promise<Idea>;
  deleteIdea(id: string): Promise<void>;
  createPeeth(input): Promise<Peeth>; updatePeethInfo(id, input): Promise<Peeth>; deletePeeth(id): Promise<void>;
  addPeethPhotos(peeth: Peeth, files: File[]): Promise<number>;     // number queued; rejects files failing validateImage
  addPeethLink(id, link); addPeethNote(id, note); updatePeethItem(...); deletePeethItem(...);   // same signatures as today
  ```
  Photos in `createIdea`/`updateIdea`/`addPeethPhotos`: for each file `compressImage` → new image id → `enqueue({type:"image.upload", entity}, {imageId, file})` then the attach op containing a placeholder `ImageItem { id, url: "", path: "", name, addedBy, createdAt, pending: true }`. Upload folder: `"ideas"` or `` `peeths/${peeth.id}` `` (as today).
  `useIdea`/`usePeeth`: if the outbox has a `*.create` for that id, ignore a 404 error from revalidate (don't show "not found").

- [ ] **Step 1: Implement.** Call `kick()` after every successful enqueue.
- [ ] **Step 2:** `npx tsc --noEmit` → errors only in the view files listed in Task 7 (expected, fixed there).
- [ ] **Step 3: Commit** `feat(offline): data layer enqueues changes and shows pending state`

---

### Task 7: Views use the new data API

**Files:**
- Modify: `src/components/views/IdeaForm.tsx`, `src/components/views/PeethDetailView.tsx`, `src/components/views/PeethInfoDialog.tsx`, `src/components/views/IdeasListView.tsx`, `src/components/views/IdeaDetailView.tsx`, `src/components/images/ImageGrid.tsx`
- Delete: `src/components/images/useUploadQueue.ts`

**Interfaces:**
- Consumes: Task 6 API.
- `ImageGrid` props: remove `queue`, `onRetry`, `onDismiss`. Tiles for images with `pending` show the existing spinner overlay ("Saving…"); `failed` show the existing error overlay (tap → opens sync sheet from Task 8 via `openSyncSheet()`; until Task 8, no-op).
- `IdeaForm`: keep picked photos as `{ file, previewUrl }` in local state (shown with `pending`), no upload until Save. Save no longer waits for uploads; it calls `createIdea/updateIdea(..., newPhotos)` and navigates. Remove the "photos are still uploading" guard.
- Gallery: `onAddFiles` → `addPeethPhotos(peeth, files)`; toast `Saving N photo(s)…` or the validation error.
- Peeth info / links / notes / deletes: same toasts as today, shown immediately.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npm test` → all pass.
- [ ] **Step 3: Manual (online):** add a note, link, photo on a peeth; create, edit (title only), delete an idea — each appears instantly and survives a reload after a few seconds.
- [ ] **Step 4: Commit** `feat(offline): views update instantly via outbox`

---

### Task 8: Sync status pill, sheet, toasts, logout guard

**Files:**
- Create: `src/components/SyncStatus.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `startSync`, `useSyncStatus`, `retryEntry`, `discardEntry`, `onEntityDropped` (Task 5), `useOutbox` (Task 4).
- Produces: `<SyncStatus />`, `openSyncSheet(): void`.
- Copy (exact):
  - syncing: `Saving N…`
  - offline: `Offline · N saved`
  - auth: `Log in to save N` (tap → `/login?next=<current path>`)
  - failed: `N not saved`
  - entity dropped toast: `This was deleted by someone else, so your change could not be saved.`
  - storage fallback notice (once): `This browser can't save changes offline.`
  - logout confirm when queue non-empty: title `N changes are not saved yet`, message `Log out anyway? They will stay on this device and be saved after you log in again.`
- `AppShell` mounts `startSync()` once; places `<SyncStatus />` before the profile button; pill hidden when idle with 0 pending/failed. Logout keeps the outbox (only `clearAllCache()` of `kv`).

- [ ] **Step 1: Implement.** Sheet uses existing `Modal`; lists entries with a one-line description (e.g. "Add note · हिंगुला शक्तिपीठ"), status, `lastError`, Retry / Discard buttons.
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npm test` → pass.
- [ ] **Step 3: Commit** `feat(offline): sync status in header and logout guard`

---

### Task 9: End-to-end checks (offline, reload, auth, tabs)

Use Chrome DevTools (Network → Offline) on the dev server, mobile width 390px.

- [ ] **Step 1:** Go offline. Add 2 photos + a note to a peeth, create an idea with 1 photo, edit another idea's title, delete a link. All show instantly; pill shows `Offline · N saved`.
- [ ] **Step 2:** Reload while still offline (page served from browser cache; if the page itself cannot load offline that is expected — go online for the reload only, with Network throttling "Offline" re-enabled right after). Pending items still show, photo tiles show their local previews.
- [ ] **Step 3:** Go online. Pill shows `Saving N…` then disappears. Reload: everything is on the server, no duplicates; photos open from GitHub URLs.
- [ ] **Step 4:** Create and delete an idea while offline → after going online, no request for it in the Network tab.
- [ ] **Step 5:** Clear the `harihaat_auth` cookie (DevTools → Application) with items queued → pill shows `Log in to save N`, no redirect; log in → queue drains.
- [ ] **Step 6:** Two tabs, queue items in tab A offline, go online → Network tab shows each request once total; tab B's pill updates.
- [ ] **Step 7:** In a second browser delete a peeth note, then in the first (offline) edit that note, go online → toast `This was deleted by someone else…`, note gone.
- [ ] **Step 8:** `npm run build` → succeeds.
- [ ] **Step 9: Commit** any fixes; `fix(offline): …`

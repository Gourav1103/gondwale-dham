# Offline-first changes (instant UI + background sync)

Date: 2026-11-17 · Status: draft for approval

## Why

The decoration team uses the app on phones, often on weak networks. Right now every action
(upload a photo, add a note, edit an idea, delete something) waits for the server before the
screen changes, and photo uploads are lost if the page is closed. The team wants every action
to show on screen immediately and be saved to the server in the background, without ever
silently losing a change.

## Goals

- Every create / edit / delete for ideas and Shakti Peeths (info, photos, links, notes) shows
  on screen immediately.
- Changes are saved on the device first (IndexedDB) and sent to the server in the background,
  in order. They survive weak network, no network, page reloads and closing the tab.
- Photos picked while offline are kept on the device and uploaded later; they show (from the
  local copy) right away.
- A small status in the header: "Saving 3 changes…", "Offline – 3 changes saved on this
  device", or "1 change failed" (tap → list with Retry / Discard).
- When two people change the same thing, nobody's unrelated change is lost (rules below).

## Non-goals

- Opening the app with no internet at all (service worker / offline app shell). Option B,
  possibly later. First load still needs internet; after that, network loss is fine.
- Real-time push of other people's changes. The existing refresh-on-focus / stale-time
  refetch stays.
- User accounts or per-user permissions.

## Anti-goals (would count as failure even if it "works")

- A change disappears without the user being told.
- A retried request creates duplicates (two copies of a note, photo or idea).
- Someone's edit wipes out a different field another person changed.
- Pages flicker back to old data while a background refresh races with pending changes.

## Constraints (from the current code)

- Reads already go through a stale-while-revalidate cache in IndexedDB
  ([src/lib/client/cache.ts](../../../src/lib/client/cache.ts)); writes go through
  [src/lib/client/data.ts](../../../src/lib/client/data.ts) and wait for the server.
- Photos upload one by one to a GitHub repo via `/api/upload` (GitHub accepts one commit at a
  time) — [useUploadQueue.ts](../../../src/components/images/useUploadQueue.ts).
- Ideas/Peeths use Mongo ObjectIds; links/images already accept a client-sent `id`
  (`cleanLink` / `cleanImage`), notes do not.
- Idea edit is a full replace (`PUT /api/ideas/:id`); peeth items already use granular
  `$push` / per-item PATCH/DELETE.
- Deployed on Vercel (serverless); no test framework in the repo yet.

## Approaches considered

| | What | Trade-off |
|---|---|---|
| **A (picked)** | Optimistic UI + a persistent outbox in IndexedDB, synced in the background | First open needs internet; otherwise covers weak/no network and reloads |
| B | A + service worker so the app opens with no internet | More work, risk of phones stuck on old versions after deploys; can be added on top of A later |
| C | Optimistic UI only, nothing persisted | Pending changes lost on reload/close — fails the "failure and fallback" requirement |

The team picked **A** because it gives the instant feel and safe background saving without
the deploy/versioning risk of a service worker.

## Design

### 1. Outbox (the queue of pending changes)

- New IndexedDB store `outbox` (bump DB version in `cache.ts`; same DB `harihaat-cache`).
  Each entry: `{ id, seq, createdAt, op, status: "pending" | "syncing" | "failed", attempts,
  lastError?, nextTryAt? }`.
- Photo bytes for pending uploads go in a separate store `blobs` keyed by image id
  (compressed in the browser *before* storing, so they are already small).
- `op` is a small typed union, one per server call, e.g.
  `idea.create`, `idea.patch`, `idea.delete`, `peeth.create`, `peeth.patch`, `peeth.delete`,
  `peeth.addItem` (images | links | notes), `peeth.patchItem`, `peeth.deleteItem`,
  `image.upload`.
- Ops run strictly in `seq` order, one at a time (keeps create→edit→delete order correct and
  matches GitHub's one-commit-at-a-time limit).
- Only one tab syncs at a time (Web Locks API `navigator.locks.request("harihaat-sync")`;
  if unavailable, a BroadcastChannel-based lock). Other tabs see queue changes via
  BroadcastChannel and re-render.

### 2. What the screen shows: server data + pending changes on top

- The cache keeps holding **the last server copy** of each list/record (unchanged role).
- A pure function `applyPending(serverData, outbox)` lays pending ops on top when a hook
  reads data. `useIdeas`, `useIdea`, `usePeeths`, `usePeeth` return the result.
- So a background refresh that returns older data can never "undo" something on screen:
  pending ops are re-applied until they are confirmed.
- When an op succeeds, the server's response is written to the cache (as today) and the op is
  removed from the outbox, in one step from the UI's point of view (no flicker).
- Opening a page for something created offline (e.g. a new idea) works from the pending op;
  a 404 from the background refresh is ignored while that item's create op is still queued
  (today a 404 removes the cache entry).
- New items use the device time for `createdAt` until the server copy replaces them, so lists
  sort them where expected.
- Items not yet on the server carry a `pending: true` flag (and `failed: true` if their op
  failed) so the UI can show a small "saving" / "not saved" marker.

### 3. IDs created on the device (no duplicates on retry)

- The client generates ids for everything it creates: a 24-hex ObjectId-compatible id for
  ideas/peeths, a UUID for links, notes and images.
- Server changes so retries are safe:
  - `POST /api/ideas` and `POST /api/peeths` accept an optional `id`; if a doc with that id
    already exists, return it (200) instead of creating another.
  - `POST /api/peeths/:id/{links,notes,images}`: accept client ids (add to notes), and only
    `$push` items whose id is not already there (filter `{ "notes.id": { $ne: id } }` style),
    then return the doc.
  - `/api/upload` accepts the client image id and uses it in the file name; if GitHub says the
    file already exists, return the existing file's details instead of failing.
  - Deletes are already safe to repeat (`DELETE` of a missing item → treat 404 as success).

### 4. Photos

- Picking photos: compress → save blob in `blobs` → add `image.upload` op plus the op that
  attaches it (`peeth.addItem images` or part of an idea create/patch) → the tile shows
  immediately from `URL.createObjectURL(blob)`.
- The attach op runs after its upload op (the queue order guarantees it) and uses the uploaded
  URL/path/sha from the upload result (stored back onto the queued attach op before it runs).
- Blob is deleted from IndexedDB once the attach op succeeds.
- Deleting a photo that hasn't uploaded yet just drops its queued ops and blob — no server call.
- `useUploadQueue` is replaced by this; the visual tiles stay (waiting / uploading / failed).

### 5. Ideas: edit only what changed

- Replace the full-replace `PUT` with `PATCH /api/ideas/:id` taking only what changed:
  `{ title?, description?, addLinks?, updateLinks?, removeLinkIds?, addImages?, removeImageIds? }`.
- Server applies it with `$set` on given fields and `$push` / `$pull` on arrays, and deletes
  GitHub files for removed images (as `PUT` does now). Keep `PUT` working for one release
  so phones on the old version don't break; then remove.
- The idea form computes the diff between what it loaded and what is being saved.
- Saving the form navigates immediately (like today, but without waiting).

### 6. When two people change the same thing

- Adding links / notes / photos: both kept (separate items, `$push`).
- Editing: only the changed fields are sent, so different fields never clash. The same field
  changed by two people → whichever reaches the server last wins.
- Deleted by someone else while my change is queued: server returns 404 → my op is dropped,
  along with any later queued ops for that same item, and I see a toast: "This was deleted by
  someone else, so your change could not be saved."

### 7. Failures and fallbacks

| Situation | What happens |
|---|---|
| No network / timeout / 5xx / 429 | Retry automatically with backoff (2s, 4s, 8s … max 60s). Retry immediately on `online` event, on tab focus, and when the user taps Retry. Status shows "Offline – N changes saved on this device". |
| 404 on the target item | Drop op and dependent ops for that item, toast (see §6). |
| 401 (logged out / password changed) | Pause syncing, keep the queue, show "Please log in again to save N changes". Do **not** auto-redirect from a background sync (the current `apiFetch` redirect is skipped for queued ops). After login, syncing resumes. |
| 400 / 413 / other 4xx | Mark op `failed`, stop retrying that op, keep later ops for *other* items going; ops for the *same* item wait behind it. Status shows "1 change failed" → list with the error message and Retry / Discard. Discard removes the op and its dependents and reverts the screen to server data. |
| Photo file too big / unsupported | Checked before queueing where possible (type and size), so the user gets the error immediately. |
| IndexedDB unavailable (private mode, blocked) or quota full | Fall back to today's behaviour for that action: call the server directly and wait, with the normal error toast. Show a one-time notice: "This browser can't save changes offline." |
| Closing the tab with changes still pending | Nothing is lost (they're on the device). If storage is unavailable and something is in flight, warn with `beforeunload`. |
| Two tabs open | One syncs (lock); both show the same pending state. |
| Logout (button in app) | If changes are pending, warn first: "N changes are not saved yet. Log out anyway?" Logout clears the cache but keeps the outbox unless the user confirms discarding. |

### 8. Status indicator

- Small pill in the header next to the profile button (mobile and desktop), hidden when the
  queue is empty and nothing has failed.
- States: syncing (spinner, "Saving N…"), offline (cloud-off icon, "Offline · N saved"),
  failed (red dot, "N not saved"). Tapping opens a small sheet listing pending/failed changes
  with Retry / Discard.

## Decided vs left to the builder

**Decided (by the team):** approach A; instant UI for all actions; background sync; no lost
changes; conflict rules in §6 (proposed by Claude, accepted with approach A).

**Claude's calls (can be changed):** strict FIFO single-runner queue; Web Locks for one
syncing tab; idea `PATCH` with field-level diff; keep `PUT` for one release; backoff
2s→60s; header pill design; IndexedDB fallback to direct server calls.

**Left to the builder:** exact op type names and file layout under `src/lib/client/`
(suggest `outbox.ts`, `sync.ts`, `pending.ts`); the status sheet's look (follow existing
`Modal` / `Toast` components); adding a small test setup (Vitest) for `applyPending` and the
queue's retry/drop rules, which are the parts most worth unit-testing.

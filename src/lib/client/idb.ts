"use client";

// One IndexedDB database for the app:
//   kv     – read cache (server copies of lists and records)
//   outbox – changes waiting to be sent to the server
//   blobs  – photos picked on this device that are not uploaded yet
// Every helper resolves to undefined/null instead of throwing, so a browser without
// IndexedDB (or private mode) still works — just without offline saving.

const DB_NAME = "harihaat-cache";
const DB_VERSION = 2;
export const STORES = { kv: "kv", outbox: "outbox", blobs: "blobs" } as const;
type Store = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined" || !indexedDB) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          // v1 already had "kv"; keep its data.
          if (!db.objectStoreNames.contains(STORES.kv)) db.createObjectStore(STORES.kv);
          if (!db.objectStoreNames.contains(STORES.outbox)) db.createObjectStore(STORES.outbox, { keyPath: "id" });
          if (!db.objectStoreNames.contains(STORES.blobs)) db.createObjectStore(STORES.blobs);
        };
        req.onsuccess = () => {
          const db = req.result;
          // Another tab opened a newer version: close so it can upgrade.
          db.onversionchange = () => {
            db.close();
            dbPromise = null;
          };
          resolve(db);
        };
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/** Run one request in its own transaction. Resolves undefined on any failure. */
export async function tx<T>(store: Store, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = run(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** Like tx, but reports whether a write really committed (quota errors etc. → false). */
export async function write(store: Store, run: (s: IDBObjectStore) => void): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, "readwrite");
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
      t.onabort = () => resolve(false);
      run(t.objectStore(store));
    } catch {
      resolve(false);
    }
  });
}

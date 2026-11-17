import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";

it("upgrading from v1 keeps the existing read cache (kv) and adds outbox + blobs", async () => {
  globalThis.indexedDB = new IDBFactory();
  // A browser that used the old app: DB v1 with only "kv".
  await new Promise<void>((resolve) => {
    const req = indexedDB.open("harihaat-cache", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => {
      const t = req.result.transaction("kv", "readwrite");
      t.objectStore("kv").put({ data: [1, 2], ts: 1 }, "v1:ideas");
      t.oncomplete = () => {
        req.result.close();
        resolve();
      };
    };
  });
  vi.resetModules();
  const { openDb, tx, STORES } = await import("../idb");
  const db = await openDb();
  expect([...db!.objectStoreNames].sort()).toEqual(["blobs", "kv", "outbox"]);
  expect(await tx(STORES.kv, "readonly", (s) => s.get("v1:ideas"))).toEqual({ data: [1, 2], ts: 1 });
});

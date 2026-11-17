"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { AlertCircle, CloudOff, Loader2, LogIn, RotateCw, Trash2 } from "lucide-react";
import { getCached } from "@/lib/client/cache";
import { onOfflineUnavailable } from "@/lib/client/data";
import type { Op, OutboxEntry } from "@/lib/client/ops";
import { useOutbox } from "@/lib/client/outbox";
import { IDEAS, PEETHS } from "@/lib/client/store";
import { discardEntry, onEntityDropped, retryEntry, startSync, useSyncStatus } from "@/lib/client/sync";
import type { Idea, Peeth } from "@/lib/types";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { useFeedback } from "./ui/Toast";

// ---------------- Sheet open state (so any component can open it) ----------------

let sheetOpen = false;
const sheetListeners = new Set<() => void>();
const setSheet = (v: boolean) => {
  sheetOpen = v;
  sheetListeners.forEach((fn) => fn());
};
export const openSyncSheet = () => setSheet(true);
const useSheetOpen = () =>
  useSyncExternalStore(
    (fn) => {
      sheetListeners.add(fn);
      return () => sheetListeners.delete(fn);
    },
    () => sheetOpen,
    () => false,
  );

// ---------------- Describing a change in plain words ----------------

function nameOf(kind: "idea" | "peeth", id: string): string {
  if (kind === "idea") return getCached<Idea[]>(IDEAS)?.find((i) => i.id === id)?.title ?? "an idea";
  return getCached<Peeth[]>(PEETHS)?.find((p) => p.id === id)?.name ?? "a Shakti Peeth";
}

const ITEM = { images: "photo", links: "link", notes: "note" } as const;

export function describe(op: Op): string {
  switch (op.type) {
    case "idea.create":
      return `New idea · ${op.idea.title}`;
    case "idea.patch":
      return `Edit idea · ${nameOf("idea", op.id)}`;
    case "idea.delete":
      return `Delete idea · ${nameOf("idea", op.id)}`;
    case "peeth.create":
      return `New Shakti Peeth · ${op.peeth.name}`;
    case "peeth.patch":
      return `Edit information · ${nameOf("peeth", op.id)}`;
    case "peeth.delete":
      return `Delete · ${nameOf("peeth", op.id)}`;
    case "peeth.addItem":
      return `Add ${ITEM[op.kind]} · ${nameOf("peeth", op.peethId)}`;
    case "peeth.patchItem":
      return `Edit ${ITEM[op.kind]} · ${nameOf("peeth", op.peethId)}`;
    case "peeth.deleteItem":
      return `Delete ${ITEM[op.kind]} · ${nameOf("peeth", op.peethId)}`;
    case "image.upload":
      return `Upload photo · ${op.name}`;
  }
}

// ---------------- Header pill ----------------

export function SyncStatus() {
  const status = useSyncStatus();
  const router = useRouter();
  const { toast } = useFeedback();

  useEffect(() => startSync(), []);
  useEffect(
    () => onEntityDropped(() => toast("This was deleted by someone else, so your change could not be saved.", "error")),
    [toast],
  );
  useEffect(() => onOfflineUnavailable(() => toast("This browser can't save changes offline.", "info")), [toast]);

  const { state, pending, failed } = status;
  if (state === "idle") return <SyncSheet />;

  const pill = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold whitespace-nowrap";
  return (
    <>
      {state === "auth" ? (
        <button
          type="button"
          // read the path on tap (usePathname would block prerendering of every page)
          onClick={() => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)}
          className={`${pill} bg-saffron-soft text-gold`}
        >
          <LogIn className="h-3.5 w-3.5" /> Log in to save {pending}
        </button>
      ) : (
        <button type="button" onClick={openSyncSheet} className={`${pill} ${state === "failed" ? "bg-danger-soft text-danger" : "bg-muted-2 text-ink-soft"}`}>
          {state === "syncing" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Saving {pending}…
            </>
          )}
          {state === "offline" && (
            <>
              <CloudOff className="h-3.5 w-3.5" /> Offline · {pending} saved
            </>
          )}
          {state === "failed" && (
            <>
              <AlertCircle className="h-3.5 w-3.5" /> {failed} not saved
            </>
          )}
        </button>
      )}
      <SyncSheet />
    </>
  );
}

// ---------------- Details sheet ----------------

function SyncSheet() {
  const open = useSheetOpen();
  const queue = useOutbox();
  const visible = queue.filter((e) => e.op.type !== "image.upload" || e.status === "failed");

  return (
    <Modal
      open={open}
      onClose={() => setSheet(false)}
      size="sm"
      title="Changes on this device"
      description="These are saved on this phone or computer and are sent to the server in the background."
    >
      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-faint">Everything is saved. 🙏</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((e) => (
            <Row key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </Modal>
  );
}

function Row({ entry }: { entry: OutboxEntry }) {
  const { confirm } = useFeedback();
  const failed = entry.status === "failed";
  return (
    <li className={`rounded-2xl border px-3.5 py-3 ${failed ? "border-danger/30 bg-danger-soft/40" : "border-line/70 bg-muted/50"}`}>
      <p className="font-hindi text-sm font-semibold break-anywhere">{describe(entry.op)}</p>
      <p className={`mt-0.5 text-xs ${failed ? "text-danger" : "text-ink-faint"}`}>
        {failed ? entry.lastError || "The server did not accept this change." : entry.status === "syncing" ? "Sending…" : entry.attempts ? "Waiting for the network…" : "Waiting to send"}
      </p>
      {failed && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" icon={<RotateCw className="h-4 w-4" />} onClick={() => void retryEntry(entry.id)}>
            Retry
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={async () => {
              const ok = await confirm({
                title: "Discard this change?",
                message: "It will be removed from this device and never saved.",
                confirmLabel: "Discard",
                danger: true,
              });
              if (ok) await discardEntry(entry.id);
            }}
          >
            Discard
          </Button>
        </div>
      )}
    </li>
  );
}

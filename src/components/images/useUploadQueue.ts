"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadImage, onlyImages } from "@/lib/client/images";
import { getUserName } from "@/lib/client/user";
import type { ImageItem } from "@/lib/types";

export type QueueItem = {
  key: string;
  preview: string;
  name: string;
  status: "waiting" | "uploading" | "error";
  error?: string;
  file: File;
};

/**
 * Uploads selected photos one by one (GitHub accepts one commit at a time),
 * showing a preview tile for each until it is done.
 */
export function useUploadQueue(folder: string, onUploaded: (image: ImageItem) => Promise<void> | void) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const running = useRef(false);
  const pending = useRef<QueueItem[]>([]);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (pending.current.length) {
      const item = pending.current.shift()!;
      setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, status: "uploading", error: undefined } : x)));
      try {
        const image = await uploadImage(item.file, folder, getUserName() || undefined);
        await onUploadedRef.current(image);
        setQueue((q) => q.filter((x) => x.key !== item.key));
        URL.revokeObjectURL(item.preview);
      } catch (err) {
        setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, status: "error", error: (err as Error).message } : x)));
      }
    }
    running.current = false;
  }, [folder]);

  const add = useCallback(
    (files: FileList | File[] | null) => {
      const items: QueueItem[] = onlyImages(files).map((file) => ({
        key: crypto.randomUUID(),
        preview: URL.createObjectURL(file),
        name: file.name,
        status: "waiting",
        file,
      }));
      if (!items.length) return 0;
      pending.current.push(...items);
      setQueue((q) => [...q, ...items]);
      void run();
      return items.length;
    },
    [run],
  );

  const retry = useCallback(
    (key: string) => {
      setQueue((q) => {
        const item = q.find((x) => x.key === key);
        if (item) pending.current.push(item);
        return q.map((x) => (x.key === key ? { ...x, status: "waiting", error: undefined } : x));
      });
      setTimeout(() => void run(), 0);
    },
    [run],
  );

  const dismiss = useCallback((key: string) => {
    pending.current = pending.current.filter((x) => x.key !== key);
    setQueue((q) => q.filter((x) => x.key !== key));
  }, []);

  return { queue, add, retry, dismiss, busy: queue.some((q) => q.status !== "error") };
}

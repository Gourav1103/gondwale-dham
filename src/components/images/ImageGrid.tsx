"use client";

import { useRef, useState, type DragEvent } from "react";
import { AlertCircle, ImagePlus, Loader2, Trash2 } from "lucide-react";
import type { ImageItem } from "@/lib/types";
import { Lightbox } from "./Lightbox";

/**
 * Image gallery with an "Add photos" tile (click or drag & drop),
 * a delete button on each image and a full-screen viewer.
 * Photos still saved only on this device show "Saving…"; ones the server refused show "Not saved".
 */
export function ImageGrid({
  images,
  onAddFiles,
  onDelete,
  onFailedClick,
  emptyHint = "Add photos from your phone or computer",
  compact,
}: {
  images: ImageItem[];
  onAddFiles?: (files: FileList | File[]) => void;
  onDelete?: (image: ImageItem) => Promise<void> | void;
  /** Tapping a "Not saved" photo (opens the sync details). */
  onFailedClick?: () => void;
  emptyHint?: string;
  compact?: boolean;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (onAddFiles && e.dataTransfer.files.length) onAddFiles(e.dataTransfer.files);
  };

  const remove = async (img: ImageItem) => {
    if (!onDelete) return;
    setBusyId(img.id);
    try {
      await onDelete(img);
    } finally {
      setBusyId(null);
    }
  };

  const grid = compact
    ? "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

  const isEmpty = images.length === 0;

  return (
    <div
      onDragOver={(e) => {
        if (!onAddFiles) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-3xl transition ${dragging ? "bg-saffron-soft/40 ring-4 ring-saffron/40" : ""}`}
    >
      {onAddFiles && (
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
      )}

      {isEmpty && onAddFiles ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-strong bg-muted/60 px-6 py-10 text-center transition hover:border-primary/60 hover:bg-primary-soft/20"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-card text-primary shadow-soft">
            <ImagePlus className="h-7 w-7" />
          </span>
          <span className="font-semibold text-ink">Tap to add photos</span>
          <span className="text-sm text-ink-faint">{emptyHint}</span>
        </button>
      ) : isEmpty ? (
        <p className="rounded-3xl bg-muted/60 px-6 py-8 text-center text-sm text-ink-faint">No images yet.</p>
      ) : (
        <div className={grid}>
          {images.map((img, i) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-muted-2">
              <button type="button" className="h-full w-full" onClick={() => setViewing(i)} aria-label="View larger">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name || "Reference image"}
                  loading="lazy"
                  className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${img.pending ? "opacity-60" : ""}`}
                />
              </button>
              {img.failed ? (
                <button
                  type="button"
                  onClick={onFailedClick}
                  className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-1 rounded-full bg-card/95 px-2 py-1 text-[11px] font-bold text-danger shadow"
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Not saved
                </button>
              ) : img.pending ? (
                <span className="pointer-events-none absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-1 rounded-full bg-card/90 px-2 py-1 text-[11px] font-bold text-ink-soft">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Saving…
                </span>
              ) : null}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => remove(img)}
                  disabled={busyId === img.id}
                  className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-ink/60 text-white backdrop-blur transition hover:bg-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  aria-label="Delete image"
                >
                  {busyId === img.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          ))}

          {onAddFiles && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line-strong bg-muted/60 text-ink-soft transition hover:border-primary/60 hover:text-primary"
            >
              <ImagePlus className="h-7 w-7" />
              <span className="text-xs font-semibold">Add more</span>
            </button>
          )}
        </div>
      )}

      <Lightbox images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} onDelete={onDelete ? remove : undefined} />
    </div>
  );
}

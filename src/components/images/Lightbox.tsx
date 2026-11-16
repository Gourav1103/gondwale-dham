"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Loader2, Trash2, X } from "lucide-react";
import type { ImageItem } from "@/lib/types";
import { timeAgo } from "@/components/ui/Misc";

/** Full-screen image viewer: arrows / swipe to move, Esc to close. */
export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  onDelete,
}: {
  images: ImageItem[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete?: (image: ImageItem) => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState(false);
  const touchX = useRef<number | null>(null);
  const open = index !== null && images[index] !== undefined;
  const count = images.length;

  const latest = useRef({ index, count, onIndex, onClose });
  useEffect(() => {
    latest.current = { index, count, onIndex, onClose };
  });

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      const { index: i, count: n, onIndex: go, onClose: close } = latest.current;
      if (i === null) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go((i + 1) % n);
      if (e.key === "ArrowLeft") go((i - 1 + n) % n);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // If the current image was deleted, step back or close.
  useEffect(() => {
    if (index !== null && index >= count) {
      if (count === 0) onClose();
      else onIndex(count - 1);
    }
  }, [index, count, onIndex, onClose]);

  if (!open || typeof document === "undefined") return null;
  const img = images[index];
  const go = (d: number) => onIndex((index + d + count) % count);

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex animate-fade-in flex-col bg-[#120b08]/95 text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || count < 2) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="min-w-0 pl-1 text-sm">
          <p className="font-semibold">
            {index + 1} / {count}
          </p>
          <p className="truncate text-xs text-white/60">
            {img.addedBy ? `Added by ${img.addedBy} · ` : ""}
            {timeAgo(img.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={img.url}
            target="_blank"
            rel="noreferrer"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
            aria-label="Open original"
            title="Open original"
          >
            <Download className="h-5 w-5" />
          </a>
          {onDelete && (
            <button
              className="grid h-10 w-10 place-items-center rounded-full text-[#ffb4a3] hover:bg-white/10"
              aria-label="Delete image"
              title="Delete image"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await onDelete(img);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
            </button>
          )}
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" onClick={onClose} aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={img.id}
          src={img.url}
          alt={img.name || "Reference image"}
          className="max-h-full max-w-full animate-fade-in rounded-lg object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        {count > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute top-1/2 left-2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute top-1/2 right-2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"
              aria-label="Next image"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="no-scrollbar flex justify-start gap-2 overflow-x-auto px-4 pb-5 sm:justify-center">
          {images.map((im, i) => (
            <button
              key={im.id}
              onClick={() => onIndex(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === index ? "border-saffron" : "border-transparent opacity-50 hover:opacity-90"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

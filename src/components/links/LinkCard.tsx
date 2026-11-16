"use client";

import { useState } from "react";
import { ExternalLink, Globe, Image as ImageIcon, Pencil, PlayCircle, Search, Trash2, Folder, Users, Camera } from "lucide-react";
import type { LinkItem } from "@/lib/types";
import { hostOf, LINK_LABEL, linkKind, youtubeId, type LinkKind } from "@/lib/links";
import { Modal } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";

const KIND_STYLE: Record<LinkKind, { icon: typeof Globe; cls: string }> = {
  youtube: { icon: PlayCircle, cls: "bg-[#ffe1e1] text-[#c4161c]" },
  google: { icon: Search, cls: "bg-[#e3edff] text-[#1a56c4]" },
  drive: { icon: Folder, cls: "bg-[#e1f4e6] text-[#1e7b3a]" },
  instagram: { icon: Camera, cls: "bg-[#fde4f1] text-[#b4237a]" },
  pinterest: { icon: ImageIcon, cls: "bg-[#ffe3e3] text-[#b0151f]" },
  facebook: { icon: Users, cls: "bg-[#e4ecff] text-[#2a4fa8]" },
  website: { icon: Globe, cls: "bg-saffron-soft/70 text-gold" },
};

export function LinkCard({
  link,
  onEdit,
  onDelete,
}: {
  link: LinkItem;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const kind = linkKind(link.url);
  const yt = youtubeId(link.url);
  const { icon: Icon, cls } = KIND_STYLE[kind];
  const title = link.title || (yt ? "YouTube video" : hostOf(link.url));

  return (
    <div className="group flex items-stretch gap-3 rounded-2xl border border-line/80 bg-card p-2.5 transition hover:border-line-strong hover:shadow-soft">
      {yt ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative h-[72px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-ink"
          aria-label="Play video"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <PlayCircle className="h-8 w-8 text-white drop-shadow" />
          </span>
        </button>
      ) : (
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className={`grid h-[72px] w-[72px] shrink-0 place-items-center rounded-xl ${cls}`}
          aria-hidden
          tabIndex={-1}
        >
          <Icon className="h-7 w-7" />
        </a>
      )}

      <a href={link.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <span className={`mb-1 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${cls}`}>
          {LINK_LABEL[kind]}
        </span>
        <span className="line-clamp-2 text-[15px] leading-snug font-semibold text-ink group-hover:text-primary break-anywhere">{title}</span>
        <span className="truncate text-xs text-ink-faint">
          {hostOf(link.url)}
          {link.addedBy ? ` · by ${link.addedBy}` : ""}
        </span>
      </a>

      <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
        <a href={link.url} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-muted-2 hover:text-primary" aria-label="Open link" title="Open link">
          <ExternalLink className="h-4 w-4" />
        </a>
        {onEdit && (
          <button type="button" onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-muted-2 hover:text-ink" aria-label="Edit link" title="Edit link">
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger" aria-label="Delete link" title="Delete link">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {yt && (
        <Modal
          open={playing}
          onClose={() => setPlaying(false)}
          size="lg"
          title={title}
          footer={
            <a href={link.url} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <ExternalLink className="h-4 w-4" /> Open on YouTube
            </a>
          }
        >
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-ink">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

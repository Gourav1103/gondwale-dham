"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Camera, Link2, Pencil, Trash2, UserRound } from "lucide-react";
import { deleteIdea, useIdea } from "@/lib/client/data";
import { openSyncSheet } from "@/components/SyncStatus";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorState, Skeleton, timeAgo } from "@/components/ui/Misc";
import { useFeedback } from "@/components/ui/Toast";
import { ImageGrid } from "@/components/images/ImageGrid";
import { LinkCard } from "@/components/links/LinkCard";
import Link from "next/link";
import { useState } from "react";

export function IdeaDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: idea, error, isLoading, refresh } = useIdea(id);
  const { confirm, toast } = useFeedback();
  const [deleting, setDeleting] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!idea) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState message={error ?? "Idea not found."} onRetry={refresh} />
      </div>
    );
  }

  const remove = async () => {
    const ok = await confirm({
      title: "Delete this idea?",
      message: `“${idea.title}” and its ${idea.images.length} photo(s) will be removed for everyone. This cannot be undone.`,
      confirmLabel: "Delete idea",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteIdea(idea.id);
      toast("Idea deleted");
      router.push("/ideas");
    } catch (err) {
      toast((err as Error).message, "error");
      setDeleting(false);
    }
  };

  return (
    <article className="space-y-5">
      <BackLink />

      <header className="rounded-[20px] bg-card p-6 shadow-soft sm:p-8">
        <p className="text-xs font-bold tracking-[0.14em] text-gold uppercase">Decoration idea</p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold break-anywhere sm:text-4xl">{idea.title}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-faint">
          {idea.addedBy && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4" /> {idea.addedBy}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Added {timeAgo(idea.createdAt)}
            {idea.updatedAt !== idea.createdAt && ` · edited ${timeAgo(idea.updatedAt)}`}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href={`/ideas/${idea.id}/edit`} icon={<Pencil className="h-4 w-4" />}>
            Edit idea
          </ButtonLink>
          <Button variant="secondary" onClick={remove} loading={deleting} icon={<Trash2 className="h-4 w-4" />} className="hover:!border-danger/50 hover:!text-danger">
            Delete
          </Button>
        </div>

        {idea.description ? (
          <div className="mt-6 border-t border-line/70 pt-6 text-[16px] leading-relaxed whitespace-pre-wrap text-ink break-anywhere">{idea.description}</div>
        ) : (
          <p className="mt-6 border-t border-line/70 pt-6 text-sm text-ink-faint italic">No description added.</p>
        )}
      </header>

      <section className="rounded-[20px] bg-card p-5 shadow-soft sm:p-7">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
          <Camera className="h-5 w-5 text-primary" /> Photos <span className="text-base font-normal text-ink-faint">({idea.images.length})</span>
        </h2>
        {idea.images.length ? (
          <ImageGrid images={idea.images} onFailedClick={openSyncSheet} />
        ) : (
          <p className="text-sm text-ink-faint">
            No photos yet.{" "}
            <Link href={`/ideas/${idea.id}/edit`} className="font-semibold text-primary hover:underline">
              Add photos
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-[20px] bg-card p-5 shadow-soft sm:p-7">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
          <Link2 className="h-5 w-5 text-primary" /> Reference links <span className="text-base font-normal text-ink-faint">({idea.links.length})</span>
        </h2>
        {idea.links.length ? (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {idea.links.map((l) => (
              <LinkCard key={l.id} link={l} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-faint">
            No links yet.{" "}
            <Link href={`/ideas/${idea.id}/edit`} className="font-semibold text-primary hover:underline">
              Add links
            </Link>
          </p>
        )}
      </section>
    </article>
  );
}

function BackLink() {
  return (
    <Link href="/ideas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> All ideas
    </Link>
  );
}

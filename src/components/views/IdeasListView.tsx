"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Camera, Lightbulb, Link2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { deleteIdea, useIdeas } from "@/lib/client/data";
import { ButtonLink } from "@/components/ui/Button";
import { CardGridSkeleton, EmptyState, ErrorState, PageHeader, SearchInput, timeAgo } from "@/components/ui/Misc";
import { useFeedback } from "@/components/ui/Toast";
import type { Idea } from "@/lib/types";
import { searchable } from "@/lib/links";

type Sort = "newest" | "oldest" | "az";

export function IdeasListView() {
  const { data, error, isLoading, refresh } = useIdeas();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const { confirm, toast } = useFeedback();

  const shown = useMemo(() => {
    const term = searchable(q.trim());
    let list = (data ?? []).filter(
      (i) =>
        !term ||
        searchable(i.title).includes(term) ||
        searchable(i.description).includes(term) ||
        searchable(i.addedBy).includes(term) ||
        i.links.some((l) => searchable(l.title).includes(term) || searchable(l.url).includes(term)),
    );
    if (sort === "oldest") list = [...list].reverse();
    if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title, "hi"));
    return list;
  }, [data, q, sort]);

  const remove = async (idea: Idea) => {
    const ok = await confirm({
      title: "Delete this idea?",
      message: `“${idea.title}” and its ${idea.images.length} photo(s) will be removed for everyone. This cannot be undone.`,
      confirmLabel: "Delete idea",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteIdea(idea.id);
      toast("Idea deleted");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Idea Contributor · विचार संग्रह"
        title="Decoration Ideas"
        subtitle="Every idea from the team in one place. Tap an idea to see its photos and references."
        actions={
          <ButtonLink href="/ideas/new" size="lg" icon={<Plus className="h-5 w-5" />}>
            Add idea
          </ButtonLink>
        }
      />

      {(data?.length ?? 0) > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search ideas by title, description or name…" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-12 shrink-0 rounded-full border border-line-strong/70 bg-card px-5 text-sm font-semibold text-ink-soft shadow-soft focus:border-primary focus:outline-none"
            aria-label="Sort ideas"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="az">A → Z</option>
          </select>
        </div>
      )}

      {isLoading && <CardGridSkeleton />}
      {error && !data && <ErrorState message={error} onRetry={refresh} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<Lightbulb className="h-8 w-8" />}
          title="No ideas yet"
          text="Have a thought for the decoration? Add it with photos and YouTube or Google links so the team can see it."
          action={
            <ButtonLink href="/ideas/new" icon={<Plus className="h-4 w-4" />}>
              Add the first idea
            </ButtonLink>
          }
        />
      )}

      {data && data.length > 0 && shown.length === 0 && (
        <p className="rounded-3xl bg-card px-6 py-10 text-center text-ink-soft shadow-soft">
          No ideas match “{q}”. Try another word.
        </p>
      )}

      {shown.length > 0 && (
        <>
          {q && <p className="mb-3 text-sm text-ink-faint">{shown.length} result(s)</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onDelete={() => remove(idea)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function IdeaCard({ idea, onDelete }: { idea: Idea; onDelete: () => void }) {
  const cover = idea.images[0]?.url;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[18px] bg-card shadow-soft transition hover:shadow-lift">
      <Link href={`/ideas/${idea.id}`} className="flex flex-1 flex-col">
        <div className="peeth-pattern relative h-44 overflow-hidden">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center text-primary/60">
              <Lightbulb className="h-12 w-12" />
            </div>
          )}
          {idea.images.length > 1 && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              <Camera className="h-3.5 w-3.5" /> {idea.images.length}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-2 font-display text-xl leading-snug font-semibold break-anywhere group-hover:text-primary">{idea.title}</h3>
          {idea.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft break-anywhere">{idea.description}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs font-semibold text-ink-faint">
            {idea.addedBy && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" /> {idea.addedBy}
              </span>
            )}
            <span>{timeAgo(idea.createdAt)}</span>
            {idea.links.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" /> {idea.links.length}
              </span>
            )}
            {idea.images.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Camera className="h-3.5 w-3.5" /> {idea.images.length}
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="absolute top-2.5 right-2.5 flex gap-1.5">
        <Link
          href={`/ideas/${idea.id}/edit`}
          className="grid h-9 w-9 place-items-center rounded-full bg-card/90 text-ink-soft shadow backdrop-blur hover:text-primary"
          aria-label="Edit idea"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <button
          onClick={onDelete}
          className="grid h-9 w-9 place-items-center rounded-full bg-card/90 text-ink-soft shadow backdrop-blur hover:text-danger"
          aria-label="Delete idea"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

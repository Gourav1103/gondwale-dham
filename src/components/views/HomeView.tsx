"use client";

import Link from "next/link";
import { ArrowRight, Camera, Flower2, ImageIcon, Lightbulb, Link2, NotebookPen, Plus, Search } from "lucide-react";
import { useIdeas, usePeeths } from "@/lib/client/data";
import { useUserName } from "@/lib/client/user";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton, timeAgo } from "@/components/ui/Misc";
import { SEED_DESCRIPTION, SEED_TITLE } from "@/lib/seed-data";

export function HomeView() {
  const name = useUserName();
  const ideas = useIdeas();
  const peeths = usePeeths();

  const peethList = peeths.data ?? [];
  const withPhotos = peethList.filter((p) => p.images.length > 0).length;
  const totalPhotos = peethList.reduce((n, p) => n + p.images.length, 0);
  const totalNotes = peethList.reduce((n, p) => n + p.notes.length, 0);
  const totalLinks = peethList.reduce((n, p) => n + p.links.length, 0);
  const progress = peethList.length ? Math.round((withPhotos / peethList.length) * 100) : 0;
  const recentPeeths = [...peethList]
    .filter((p) => p.updatedAt !== p.createdAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  const recentIdeas = (ideas.data ?? []).slice(0, 3);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[24px] bg-card px-6 py-9 shadow-soft sm:px-12 sm:py-14">
        {/* Logo as a soft watermark — fully inside the card, same inset as the text (px-12) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-12 hidden h-60 w-60 -translate-y-1/2 object-contain opacity-[0.12] mix-blend-multiply lg:block xl:h-64 xl:w-64"
        />
        {/* Text column leaves room for the watermark on large screens so they never overlap */}
        <div className="relative max-w-2xl lg:max-w-[calc(100%-18rem)] xl:max-w-2xl">
          <p className="font-hindi text-sm font-medium text-gold">॥ श्रीराम जय राम जय जय राम ॥</p>
          <h1 className="mt-3 font-hindi text-3xl leading-snug font-semibold text-ink sm:text-5xl sm:leading-tight">{SEED_TITLE}</h1>
          <div className="ornament mt-4 max-w-xs text-xs" aria-hidden>
            ✦
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{SEED_DESCRIPTION}</p>
          <p className="mt-2 text-sm text-ink-faint">
            <span className="font-hindi">{name ? `श्री राम, ${name} 🙏` : "श्री राम 🙏"}</span> · <span className="font-hindi">हरिहाट</span> 2026 decoration planning
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <ButtonLink href="/ideas/new" icon={<Plus className="h-4 w-4" />}>
              Share an idea
            </ButtonLink>
            <ButtonLink href="/peeths" variant="secondary" icon={<Search className="h-4 w-4" />}>
              Find a Shakti Peeth
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Two main sections */}
      <section className="grid gap-4 md:grid-cols-2">
        <SectionCard
          href="/ideas"
          icon={<Lightbulb className="h-7 w-7" />}
          eyebrow="Section 1"
          title="Idea Contributor"
          hindi="विचार संग्रह"
          text="Share decoration ideas with photos and reference links. Browse and improve everyone's ideas."
          stats={
            ideas.isLoading ? null : [{ label: "ideas shared", value: ideas.data?.length ?? 0 }]
          }
          cta="Open ideas"
        />
        <SectionCard
          href="/peeths"
          icon={<Flower2 className="h-7 w-7" />}
          eyebrow="Section 2 · Main"
          title="Decoration Management"
          hindi="५१ शक्तिपीठ"
          text="Every Shakti Peeth has its own page for reference photos, links and planning notes."
          stats={
            peeths.isLoading
              ? null
              : [
                  { label: "Shakti Peeths", value: peethList.length },
                  { label: "photos", value: totalPhotos },
                  { label: "notes", value: totalNotes },
                ]
          }
          cta="Open Shakti Peeths"
          highlight
        />
      </section>

      {/* Progress */}
      {!peeths.isLoading && peethList.length > 0 && (
        <section className="rounded-[20px] bg-card p-5 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Reference photo progress</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {withPhotos} of {peethList.length} Shakti Peeths have at least one reference photo.
              </p>
            </div>
            <span className="font-display text-3xl font-semibold text-primary">{progress}%</span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted-2">
            <div className="h-full rounded-full bg-gradient-to-r from-saffron to-primary transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-ink-soft">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><Camera className="h-3.5 w-3.5" /> {totalPhotos} photos</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><Link2 className="h-3.5 w-3.5" /> {totalLinks} links</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><NotebookPen className="h-3.5 w-3.5" /> {totalNotes} notes</span>
            {withPhotos < peethList.length && (
              <Link href="/peeths?filter=empty" className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft/60 px-3 py-1.5 text-primary hover:bg-primary-soft">
                See Peeths still needing photos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Latest ideas</h2>
            <Link href="/ideas" className="text-sm font-semibold text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2.5">
            {ideas.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
            {!ideas.isLoading && recentIdeas.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed border-line-strong/70 bg-card/60 p-6 text-center">
                <p className="text-sm text-ink-soft">No ideas yet — be the first to share one!</p>
                <ButtonLink href="/ideas/new" size="sm" className="mt-3" icon={<Plus className="h-4 w-4" />}>Add idea</ButtonLink>
              </div>
            )}
            {recentIdeas.map((idea) => (
              <Link key={idea.id} href={`/ideas/${idea.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft transition hover:shadow-lift">
                <Thumb url={idea.images[0]?.url} fallback={<Lightbulb className="h-6 w-6" />} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{idea.title}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {idea.addedBy ? `${idea.addedBy} · ` : ""}{timeAgo(idea.createdAt)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Recently updated Peeths</h2>
            <Link href="/peeths" className="text-sm font-semibold text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2.5">
            {peeths.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
            {!peeths.isLoading && recentPeeths.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed border-line-strong/70 bg-card/60 p-6 text-center text-sm text-ink-soft">
                Nothing updated yet. Open any Shakti Peeth to add photos, links and notes.
              </div>
            )}
            {recentPeeths.map((p) => (
              <Link key={p.id} href={`/peeths/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft transition hover:shadow-lift">
                <Thumb url={p.images[0]?.url} fallback={<span className="font-display text-lg font-bold">{p.number}</span>} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-hindi font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {p.images.length} photos · {p.links.length} links · {p.notes.length} notes · {timeAgo(p.updatedAt)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick guide */}
      <section className="rounded-[20px] border border-line bg-muted/60 p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold">How to use this app</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Lightbulb, t: "Share ideas", d: "Go to Ideas → “Add idea”. Write it down, attach photos and YouTube / Google links." },
            { icon: Flower2, t: "Open a Shakti Peeth", d: "Search by name or place. Each Peeth has its own photos, links and notes." },
            { icon: ImageIcon, t: "Add references", d: "Upload photos straight from your phone. Tap any photo to see it big." },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card font-display font-bold text-primary shadow-soft">{i + 1}</span>
              <div>
                <p className="flex items-center gap-1.5 font-semibold"><s.icon className="h-4 w-4 text-gold" /> {s.t}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Thumb({ url, fallback }: { url?: string; fallback: React.ReactNode }) {
  return (
    <span className="peeth-pattern grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl text-primary">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        fallback
      )}
    </span>
  );
}

function SectionCard({
  href,
  icon,
  eyebrow,
  title,
  hindi,
  text,
  stats,
  cta,
  highlight,
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  hindi: string;
  text: string;
  stats: { label: string; value: number }[] | null;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-[20px] p-6 shadow-soft transition hover:shadow-lift sm:p-7 ${
        highlight ? "bg-card ring-2 ring-saffron/40" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft/70 text-primary">{icon}</span>
        <span className="font-hindi text-lg font-semibold text-gold/80">{hindi}</span>
      </div>
      <p className="mt-5 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
        {stats === null ? (
          <Skeleton className="h-8 w-40" />
        ) : (
          stats.map((s) => (
            <span key={s.label} className="text-sm text-ink-soft">
              <span className="font-display text-2xl font-semibold text-ink">{s.value}</span> {s.label}
            </span>
          ))
        )}
      </div>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary">
        {cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

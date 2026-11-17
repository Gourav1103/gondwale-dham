"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Camera, LayoutGrid, Link2, List, MapPin, NotebookPen, Plus } from "lucide-react";
import { usePeeths } from "@/lib/client/data";
import { Button } from "@/components/ui/Button";
import { CardGridSkeleton, ErrorState, PageHeader, SearchInput } from "@/components/ui/Misc";
import type { Peeth } from "@/lib/types";
import { PeethInfoDialog } from "./PeethInfoDialog";
import { searchable } from "@/lib/links";

type Filter = "all" | "empty" | "photos";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "empty", label: "Needs photos" },
  { id: "photos", label: "Has photos" },
];

// Remember grid/list choice on this device.
const VIEW_KEY = "harihaat:peeth-view";
const viewListeners = new Set<() => void>();
function useViewMode() {
  const mode = useSyncExternalStore(
    (fn) => {
      viewListeners.add(fn);
      return () => viewListeners.delete(fn);
    },
    () => {
      try {
        return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
      } catch {
        return "grid";
      }
    },
    () => "grid",
  );
  const set = (m: "grid" | "list") => {
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {}
    viewListeners.forEach((fn) => fn());
  };
  return [mode, set] as const;
}

export function PeethsListView() {
  const { data, error, isLoading, refresh } = usePeeths();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const filter = (FILTERS.some((f) => f.id === params.get("filter")) ? params.get("filter") : "all") as Filter;
  const [view, setView] = useViewMode();
  const [adding, setAdding] = useState(false);

  const setFilter = (f: Filter) => router.replace(f === "all" ? "/peeths" : `/peeths?filter=${f}`, { scroll: false });

  const shown = useMemo(() => {
    const term = searchable(q.trim());
    return (data ?? []).filter((p) => {
      if (filter === "empty" && p.images.length > 0) return false;
      if (filter === "photos" && p.images.length === 0) return false;
      if (!term) return true;
      return (
        String(p.number) === term ||
        searchable(p.name).includes(term) ||
        searchable(p.place).includes(term) ||
        searchable(p.description).includes(term)
      );
    });
  }, [data, q, filter]);

  const nextNumber = (data ?? []).reduce((m, p) => Math.max(m, p.number), 0) + 1;

  return (
    <>
      <PeethInfoDialog open={adding} onClose={() => setAdding(false)} nextNumber={nextNumber} onSaved={(p) => router.push(`/peeths/${p.id}`)} />
      <PageHeader
        eyebrow="Decoration Management · सजावट प्रबंधन"
        title={<span className="font-hindi">माँ सती के {data?.length ?? 51} शक्तिपीठ</span>}
        subtitle="Choose a Shakti Peeth to manage its reference photos, links and decoration notes."
        actions={
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add Peeth
          </Button>
        }
      />

      <div className="mb-6 space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, place or number (e.g. कामाख्या, असम, 17)…" />
        <div className="flex items-center gap-2">
          {/* py/-my keep the active chip's ring from being clipped by the scroll box */}
          <div className="no-scrollbar -my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 pl-px sm:gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold transition sm:px-4 sm:text-sm ${
                  filter === f.id ? "bg-primary-soft text-primary ring-1 ring-primary/25" : "border border-line-strong/70 bg-card text-ink-soft hover:border-saffron"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 rounded-full border border-line-strong/70 bg-card p-1">
            {(["grid", "list"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                className={`grid h-8 w-9 place-items-center rounded-full transition ${view === m ? "bg-primary-soft text-primary" : "text-ink-faint hover:text-ink"}`}
                aria-label={m === "grid" ? "Card view" : "List view"}
                title={m === "grid" ? "Card view" : "List view"}
              >
                {m === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <CardGridSkeleton count={9} />}
      {error && !data && <ErrorState message={error} onRetry={refresh} />}

      {data && shown.length === 0 && (
        <p className="rounded-3xl bg-card px-6 py-10 text-center text-ink-soft shadow-soft">
          {q ? `No Shakti Peeth matches “${q}”.` : filter === "empty" ? "Wonderful — every Shakti Peeth has photos! 🎉" : "Nothing to show."}
        </p>
      )}

      {shown.length > 0 && (q || filter !== "all") && <p className="mb-3 text-sm text-ink-faint">{shown.length} Shakti Peeth(s)</p>}

      {shown.length > 0 &&
        (view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <PeethCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
            {shown.map((p, i) => (
              <PeethRow key={p.id} p={p} first={i === 0} />
            ))}
          </div>
        ))}
    </>
  );
}

function Counts({ p }: { p: Peeth }) {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold text-ink-faint">
      <span className={`inline-flex items-center gap-1 ${p.images.length ? "text-gold" : ""}`} title="Photos">
        <Camera className="h-3.5 w-3.5" /> {p.images.length}
      </span>
      <span className="inline-flex items-center gap-1" title="Links">
        <Link2 className="h-3.5 w-3.5" /> {p.links.length}
      </span>
      <span className="inline-flex items-center gap-1" title="Notes">
        <NotebookPen className="h-3.5 w-3.5" /> {p.notes.length}
      </span>
    </div>
  );
}

function PeethCard({ p }: { p: Peeth }) {
  const cover = p.images[0]?.url;
  return (
    <Link href={`/peeths/${p.id}`} className="group flex flex-col overflow-hidden rounded-[18px] bg-card shadow-soft transition hover:shadow-lift">
      <div className="peeth-pattern relative h-36 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-6xl font-semibold text-primary/15">{p.number}</span>
        )}
        <span className="absolute top-3 left-3 grid h-10 min-w-10 place-items-center rounded-full bg-card/95 px-2 font-display text-base font-bold text-primary shadow">
          {p.number}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-hindi text-xl leading-snug font-semibold break-anywhere group-hover:text-primary">{p.name}</h3>
        {p.place && (
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink-soft">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span className="line-clamp-2">{p.place}</span>
          </p>
        )}
        {p.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-faint">{p.description}</p>}
        <div className="mt-auto pt-4">
          <Counts p={p} />
        </div>
      </div>
    </Link>
  );
}

function PeethRow({ p, first }: { p: Peeth; first: boolean }) {
  return (
    <Link href={`/peeths/${p.id}`} className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-muted sm:gap-4 sm:px-5 ${first ? "" : "border-t border-line/60"}`}>
      <span className="peeth-pattern grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl font-display font-bold text-primary">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0].url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          p.number
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-hindi font-semibold">
          <span className="mr-1.5 font-display text-sm text-ink-faint">{p.number}.</span>
          {p.name}
        </p>
        <p className="truncate text-sm text-ink-faint">{p.place}</p>
      </div>
      <div className="hidden sm:block">
        <Counts p={p} />
      </div>
    </Link>
  );
}

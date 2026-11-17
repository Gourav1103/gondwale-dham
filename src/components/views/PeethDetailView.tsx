"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, Link2, MapPin, NotebookPen, Pencil, Plus, Save, Trash2, UserRound } from "lucide-react";
import type { NoteItem, Peeth } from "@/lib/types";
import { addPeethPhotos, addPeethLink, addPeethNote, deletePeethItem, updatePeethItem, usePeeth, usePeeths } from "@/lib/client/data";
import { useUserName } from "@/lib/client/user";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ErrorState, Skeleton, timeAgo } from "@/components/ui/Misc";
import { useFeedback } from "@/components/ui/Toast";
import { ImageGrid } from "@/components/images/ImageGrid";
import { onlyImages } from "@/lib/client/images";
import { openSyncSheet } from "@/components/SyncStatus";
import { getUserName } from "@/lib/client/user";
import { LinkCard } from "@/components/links/LinkCard";
import { LinkForm } from "@/components/links/LinkForm";
import { PeethInfoDialog } from "./PeethInfoDialog";

export function PeethDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: peeth, error, isLoading, refresh } = usePeeth(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (!peeth) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState message={error ?? "Shakti Peeth not found."} onRetry={refresh} />
      </div>
    );
  }
  return <Workspace peeth={peeth} />;
}

function BackLink() {
  return (
    <Link href="/peeths" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> All Shakti Peeths
    </Link>
  );
}

function Workspace({ peeth }: { peeth: Peeth }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { data: all } = usePeeths();
  const idx = all?.findIndex((p) => p.id === peeth.id) ?? -1;
  const prev = idx > 0 ? all![idx - 1] : undefined;
  const next = idx >= 0 && idx < (all?.length ?? 0) - 1 ? all![idx + 1] : undefined;

  const sections = [
    { id: "gallery", label: "Photos", count: peeth.images.length, icon: Camera },
    { id: "links", label: "Links", count: peeth.links.length, icon: Link2 },
    { id: "notes", label: "Notes", count: peeth.notes.length, icon: NotebookPen },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <BackLink />
        <div className="flex gap-1.5">
          <NavBtn peeth={prev} dir="prev" />
          <NavBtn peeth={next} dir="next" />
        </div>
      </div>

      {/* A. Basic information */}
      <header className="relative overflow-hidden rounded-[20px] bg-card shadow-soft">
        <div className="h-px bg-gradient-to-r from-transparent via-saffron to-transparent" />
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary ring-1 ring-primary/15">
              <span className="font-display text-2xl font-bold">{peeth.number}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-[0.14em] text-gold uppercase">Shakti Peeth #{peeth.number}</p>
              <h1 className="mt-1 font-hindi text-3xl leading-snug font-semibold break-anywhere sm:text-4xl">{peeth.name}</h1>
              {peeth.place && (
                <p className="mt-2 flex items-start gap-1.5 text-[15px] text-ink-soft">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {peeth.place}
                </p>
              )}
            </div>
          </div>
          {peeth.description && <p className="mt-5 text-[16px] leading-relaxed text-ink break-anywhere">{peeth.description}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit information
            </Button>
            <span className="text-xs text-ink-faint">Last updated {timeAgo(peeth.updatedAt)}</span>
          </div>
        </div>
      </header>

      <PeethInfoDialog open={editing} onClose={() => setEditing(false)} peeth={peeth} onDeleted={() => router.push("/peeths")} />

      {/* Quick jump between sections */}
      <nav className="no-scrollbar sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto bg-surface/90 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-full sm:px-2">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line-strong/60 bg-card px-4 text-sm font-semibold text-ink-soft shadow-sm hover:border-primary/50 hover:text-primary"
          >
            <s.icon className="h-4 w-4" /> {s.label}
            <span className="rounded-full bg-muted-2 px-2 py-0.5 text-xs">{s.count}</span>
          </a>
        ))}
      </nav>

      <GallerySection peeth={peeth} />
      <LinksSection peeth={peeth} />
      <NotesSection peeth={peeth} />
    </div>
  );
}

function NavBtn({ peeth, dir }: { peeth?: Peeth; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const cls = "grid h-9 w-9 place-items-center rounded-full border border-line-strong/60 bg-card text-ink-soft transition";
  if (!peeth) return <span className={`${cls} opacity-40`}><Icon className="h-5 w-5" /></span>;
  return (
    <Link href={`/peeths/${peeth.id}`} className={`${cls} hover:border-primary/50 hover:text-primary`} title={`${dir === "prev" ? "Previous" : "Next"}: ${peeth.name}`} aria-label={dir === "prev" ? "Previous Shakti Peeth" : "Next Shakti Peeth"}>
      <Icon className="h-5 w-5" />
    </Link>
  );
}

function Section({
  id,
  icon,
  title,
  subtitle,
  count,
  action,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-[20px] bg-card p-5 shadow-soft sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft/60 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">
            {title} <span className="text-base font-normal text-ink-faint">({count})</span>
          </h2>
          <p className="text-sm text-ink-faint">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------------- B. Decoration reference gallery ----------------

function GallerySection({ peeth }: { peeth: Peeth }) {
  const { toast, confirm } = useFeedback();
  const add = async (files: FileList | File[]) => {
    const list = onlyImages(files);
    if (!list.length) return toast("Please choose image files (JPG, PNG, WEBP).", "error");
    // Photos appear at once (saved on this device) and upload in the background.
    const { added, errors } = await addPeethPhotos(peeth, list, getUserName() || undefined);
    if (errors.length) toast(errors[0], "error");
    if (added) toast(`Saving ${added} photo${added > 1 ? "s" : ""}…`, "info");
  };

  return (
    <Section
      id="gallery"
      icon={<Camera className="h-5 w-5" />}
      title="Decoration reference photos"
      subtitle="Photos that help the team build crafts and structures for this Mata Ji."
      count={peeth.images.length}
    >
      <ImageGrid
        images={peeth.images}
        onAddFiles={(files) => void add(files)}
        onFailedClick={openSyncSheet}
        emptyHint="Select one or many photos — they are saved for the whole team"
        onDelete={async (img) => {
          const ok = await confirm({ title: "Delete this photo?", message: "It will be removed for everyone.", confirmLabel: "Delete photo", danger: true });
          if (!ok) return;
          try {
            await deletePeethItem(peeth.id, "images", img.id);
            toast("Photo deleted");
          } catch (err) {
            toast((err as Error).message, "error");
          }
        }}
      />
    </Section>
  );
}

// ---------------- C. Reference links ----------------

function LinksSection({ peeth }: { peeth: Peeth }) {
  const { toast, confirm } = useFeedback();
  const userName = useUserName();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <Section
      id="links"
      icon={<Link2 className="h-5 w-5" />}
      title="Reference links"
      subtitle="YouTube videos, Google references, websites and other resources."
      count={peeth.links.length}
      action={
        !adding && peeth.links.length > 0 ? (
          <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-2.5">
        {(adding || peeth.links.length === 0) && (
          <LinkForm
            autoFocus={adding}
            onCancel={peeth.links.length ? () => setAdding(false) : undefined}
            onSubmit={async (v) => {
              await addPeethLink(peeth.id, { ...v, addedBy: userName || undefined });
              toast("Link added");
            }}
          />
        )}
        <div className="grid gap-2.5 lg:grid-cols-2">
          {[...peeth.links].reverse().map((l) =>
            editing === l.id ? (
              <div key={l.id} className="lg:col-span-2">
                <LinkForm
                  initial={{ url: l.url, title: l.title }}
                  submitLabel="Save link"
                  autoFocus
                  onCancel={() => setEditing(null)}
                  onSubmit={async (v) => {
                    await updatePeethItem(peeth.id, "links", l.id, { url: v.url, title: v.title ?? "" });
                    setEditing(null);
                    toast("Link updated");
                  }}
                />
              </div>
            ) : (
              <LinkCard
                key={l.id}
                link={l}
                onEdit={() => setEditing(l.id)}
                onDelete={async () => {
                  if (!(await confirm({ title: "Delete this link?", message: l.title || l.url, confirmLabel: "Delete link", danger: true }))) return;
                  try {
                    await deletePeethItem(peeth.id, "links", l.id);
                    toast("Link deleted");
                  } catch (err) {
                    toast((err as Error).message, "error");
                  }
                }}
              />
            ),
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------------- D. Notes ----------------

function NotesSection({ peeth }: { peeth: Peeth }) {
  const { toast } = useFeedback();
  const userName = useUserName();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const notes = [...peeth.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addPeethNote(peeth.id, { text, addedBy: userName || undefined });
      setText("");
      toast("Note saved");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      id="notes"
      icon={<NotebookPen className="h-5 w-5" />}
      title="Decoration notes"
      subtitle="Materials, measurements, suggestions, creative thoughts — anything useful."
      count={peeth.notes.length}
    >
      <div className="rounded-2xl border border-line bg-muted/50 p-3 sm:p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void add();
          }}
          minRows={3}
          placeholder="Write a new note… (e.g. Need 20 m red cloth and marigold garlands for the entrance)"
          aria-label="New note"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="hidden text-xs text-ink-faint sm:block">{userName ? `Saving as ${userName}` : "Tip: add your name from the top bar"}</span>
          <Button size="sm" onClick={add} loading={saving} disabled={!text.trim()} icon={<Save className="h-4 w-4" />} className="ml-auto">
            Save note
          </Button>
        </div>
      </div>

      {notes.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <NoteCard key={n.id} peethId={peeth.id} note={n} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-ink-faint">No notes yet. The first note you save will appear here.</p>
      )}
    </Section>
  );
}

function NoteCard({ peethId, note }: { peethId: string; note: NoteItem }) {
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await updatePeethItem(peethId, "notes", note.id, { text: draft });
      setEditing(false);
      toast("Note updated");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: "Delete this note?", message: "It will be removed for everyone.", confirmLabel: "Delete note", danger: true }))) return;
    setBusy(true);
    try {
      await deletePeethItem(peethId, "notes", note.id);
      toast("Note deleted");
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-saffron/25 bg-[#fffbf2] p-4">
      {editing ? (
        <>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} minRows={3} autoFocus aria-label="Edit note" />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(note.text);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={busy} disabled={!draft.trim()}>
              Save
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="flex-1 text-[15px] leading-relaxed whitespace-pre-wrap text-ink break-anywhere">{note.text}</p>
          <div className="mt-3 flex items-center gap-2 border-t border-saffron/20 pt-2.5">
            <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">
              {note.addedBy && (
                <>
                  <UserRound className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                  {note.addedBy} ·{" "}
                </>
              )}
              {timeAgo(note.createdAt)}
              {note.updatedAt !== note.createdAt && " · edited"}
            </span>
            <button onClick={() => setEditing(true)} className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-muted-2 hover:text-ink" aria-label="Edit note" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={remove} disabled={busy} className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger" aria-label="Delete note" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

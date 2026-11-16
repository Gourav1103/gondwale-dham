"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Camera, Type } from "lucide-react";
import type { Idea, ImageItem, LinkItem } from "@/lib/types";
import { createIdea, updateIdea } from "@/lib/client/data";
import { useUserName } from "@/lib/client/user";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Field";
import { useFeedback } from "@/components/ui/Toast";
import { ImageGrid } from "@/components/images/ImageGrid";
import { useUploadQueue } from "@/components/images/useUploadQueue";
import { LinkCard } from "@/components/links/LinkCard";
import { LinkForm } from "@/components/links/LinkForm";

export function IdeaForm({ idea }: { idea?: Idea }) {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const userName = useUserName();

  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [links, setLinks] = useState<LinkItem[]>(idea?.links ?? []);
  const [images, setImages] = useState<ImageItem[]>(idea?.images ?? []);
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const uploads = useUploadQueue("ideas", (img) => {
    setImages((list) => [...list, img]);
    setDirty(true);
  });

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const touch = () => setDirty(true);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please give your idea a title.");
      document.getElementById("idea-title")?.focus();
      return;
    }
    if (uploads.busy) {
      toast("Please wait — photos are still uploading.", "info");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const input = { title, description, links, images, addedBy: idea ? idea.addedBy : userName || undefined };
      const saved = idea ? await updateIdea(idea.id, input) : await createIdea(input);
      toast(idea ? "Changes saved" : "Idea added. Thank you! 🙏");
      router.push(`/ideas/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (dirty && !(await confirm({ title: "Leave without saving?", message: "Your changes on this form will be lost.", confirmLabel: "Leave", danger: true }))) return;
    router.back();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section icon={<Type className="h-5 w-5" />} title="About the idea">
        <div className="space-y-4">
          <div>
            <Label htmlFor="idea-title" required>
              Idea title
            </Label>
            <Input
              id="idea-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                touch();
              }}
              placeholder="e.g. Flower rangoli entrance for Kamakhya Peeth"
              maxLength={200}
              autoFocus={!idea}
            />
          </div>
          <div>
            <Label htmlFor="idea-desc" hint="Materials, size, colours, steps…">
              Description
            </Label>
            <Textarea
              id="idea-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                touch();
              }}
              minRows={5}
              placeholder="Explain your idea in detail so others can understand and build it."
            />
          </div>
        </div>
      </Section>

      <Section icon={<Link2 className="h-5 w-5" />} title="Reference links" count={links.length} hint="YouTube videos, Google images, websites…">
        <div className="space-y-2.5">
          {links.map((l) =>
            editingLink === l.id ? (
              <LinkForm
                key={l.id}
                initial={l}
                submitLabel="Save link"
                autoFocus
                onCancel={() => setEditingLink(null)}
                onSubmit={(v) => {
                  setLinks((all) => all.map((x) => (x.id === l.id ? { ...x, ...v } : x)));
                  setEditingLink(null);
                  touch();
                }}
              />
            ) : (
              <LinkCard
                key={l.id}
                link={l}
                onEdit={() => setEditingLink(l.id)}
                onDelete={() => {
                  setLinks((all) => all.filter((x) => x.id !== l.id));
                  touch();
                }}
              />
            ),
          )}
          <LinkForm
            onSubmit={(v) => {
              setLinks((all) => [...all, { id: crypto.randomUUID(), ...v, addedBy: userName || undefined, createdAt: new Date().toISOString() }]);
              touch();
            }}
          />
        </div>
      </Section>

      <Section icon={<Camera className="h-5 w-5" />} title="Photos" count={images.length} hint="You can select many at once">
        <ImageGrid
          images={images}
          queue={uploads.queue}
          onAddFiles={uploads.add}
          onRetry={uploads.retry}
          onDismiss={uploads.dismiss}
          onDelete={(img) => {
            setImages((all) => all.filter((x) => x.id !== img.id));
            touch();
          }}
          compact
        />
      </Section>

      {error && <FieldError>{error}</FieldError>}

      {/* Sticky action bar so Save is always reachable on phones */}
      <div className="sticky bottom-[76px] z-20 -mx-4 border-t border-line/70 bg-surface/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <div className="flex items-center justify-end gap-2">
          {!idea && userName && <span className="mr-auto hidden text-sm text-ink-faint sm:block">Posting as <b className="text-ink-soft">{userName}</b></span>}
          <Button variant="secondary" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={uploads.busy} icon={<Check className="h-4 w-4" />} className="min-w-36">
            {uploads.busy ? "Uploading photos…" : idea ? "Save changes" : "Save idea"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  hint,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] bg-card p-5 shadow-soft sm:p-7">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft/60 text-primary">{icon}</span>
        <h2 className="font-display text-xl font-semibold">
          {title}
          {count ? <span className="ml-2 text-base font-normal text-ink-faint">({count})</span> : null}
        </h2>
        {hint && <span className="text-sm text-ink-faint sm:ml-auto">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

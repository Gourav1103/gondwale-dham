"use client";

import { useState, type FormEvent } from "react";
import { Link2, Plus } from "lucide-react";
import { Input, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { isValidUrl, normalizeUrl } from "@/lib/links";

/** URL + optional title. Used for adding and for editing a link. */
export function LinkForm({
  initial,
  submitLabel = "Add link",
  onSubmit,
  onCancel,
  autoFocus,
}: {
  initial?: { url: string; title?: string };
  submitLabel?: string;
  onSubmit: (link: { url: string; title?: string }) => Promise<void> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Not a <form>: this is often placed inside another form (the idea form).
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return setError("Paste a link first.");
    if (!isValidUrl(url)) return setError("This doesn't look like a web link. Example: https://youtube.com/…");
    setError("");
    setSaving(true);
    try {
      await onSubmit({ url: normalizeUrl(url), title: title.trim() || undefined });
      if (!initial) {
        setUrl("");
        setTitle("");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-muted/50 p-3 sm:p-4">
      <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr]">
        <div className="relative">
          <Link2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onKey}
            placeholder="Paste link (YouTube, Google, website…)"
            inputMode="url"
            autoFocus={autoFocus}
            className="pl-10"
            aria-label="Link URL"
          />
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKey} placeholder="Short title (optional)" aria-label="Link title" />
      </div>
      <FieldError>{error}</FieldError>
      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={() => submit()} loading={saving} icon={!initial ? <Plus className="h-4 w-4" /> : undefined}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

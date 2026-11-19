"use client";

import { useState } from "react";
import type { Peeth } from "@/lib/types";
import { createPeeth, updatePeethInfo } from "@/lib/client/data";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Field";
import { useFeedback } from "@/components/ui/Toast";
import { PeethDeleteButton } from "./PeethDeleteButton";

/** Add a new Shakti Peeth, or edit the basic information of an existing one. */
export function PeethInfoDialog({
  open,
  onClose,
  peeth,
  nextNumber,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  peeth?: Peeth;
  nextNumber?: number;
  onSaved?: (p: Peeth) => void;
  onDeleted?: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={peeth ? "Edit basic information" : "Add a Shakti Peeth"} description={peeth ? "Changes are visible to the whole team." : undefined}>
      {open && <Body peeth={peeth} nextNumber={nextNumber} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />}
    </Modal>
  );
}

function Body({
  peeth,
  nextNumber,
  onClose,
  onSaved,
  onDeleted,
}: {
  peeth?: Peeth;
  nextNumber?: number;
  onClose: () => void;
  onSaved?: (p: Peeth) => void;
  onDeleted?: () => void;
}) {
  const { toast } = useFeedback();
  const [number, setNumber] = useState(String(peeth?.number ?? nextNumber ?? ""));
  const [name, setName] = useState(peeth?.name ?? "");
  const [place, setPlace] = useState(peeth?.place ?? "");
  const [description, setDescription] = useState(peeth?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter the name.");
    const n = Number(number);
    if (number && (!Number.isInteger(n) || n < 1)) return setError("Number must be a whole number like 12.");
    setSaving(true);
    setError("");
    try {
      const input = { name, place, description, ...(number ? { number: n } : {}) };
      const saved = peeth ? await updatePeethInfo(peeth.id, input) : await createPeeth(input);
      toast(peeth ? "Information updated" : "Shakti Peeth added");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <div>
          <Label htmlFor="p-num">No.</Label>
          <Input id="p-num" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="52" />
        </div>
        <div>
          <Label htmlFor="p-name" required>
            Name
          </Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. कामाख्या शक्तिपीठ" className="font-hindi" maxLength={200} />
        </div>
      </div>
      <div>
        <Label htmlFor="p-place">Place / location</Label>
        <Input id="p-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. गुवाहाटी, असम, भारत" maxLength={300} />
      </div>
      <div>
        <Label htmlFor="p-desc">Short description</Label>
        <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} minRows={4} placeholder="About this Shakti Peeth…" />
      </div>
      <FieldError>{error}</FieldError>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
        {peeth && (
          <PeethDeleteButton
            peeth={peeth}
            className="justify-center sm:mr-auto"
            onDeleted={() => {
              onClose();
              onDeleted?.();
            }}
          />
        )}
        <Button variant="secondary" onClick={onClose} className={peeth ? "" : "sm:ml-auto"}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {peeth ? "Save changes" : "Add Shakti Peeth"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import type { Peeth } from "@/lib/types";
import { deletePeeth } from "@/lib/client/data";
import { unlockAdmin, useIsAdmin } from "@/lib/client/role";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFeedback } from "@/components/ui/Toast";

/**
 * Delete a Shakti Peeth — admins only. Everyone else sees the button disabled,
 * with a way to unlock admin by entering the admin password.
 */
export function PeethDeleteButton({ peeth, onDeleted, className = "" }: { peeth: Peeth; onDeleted?: () => void; className?: string }) {
  const isAdmin = useIsAdmin();
  const { toast, confirm } = useFeedback();
  const [deleting, setDeleting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const remove = async () => {
    const total = peeth.images.length + peeth.links.length + peeth.notes.length;
    const ok = await confirm({
      title: `Delete ${peeth.name}?`,
      message: `This removes the Shakti Peeth${total ? ` together with its ${peeth.images.length} photos, ${peeth.links.length} links and ${peeth.notes.length} notes` : ""} for everyone. This cannot be undone.`,
      confirmLabel: "Delete permanently",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deletePeeth(peeth.id);
      toast("Shakti Peeth deleted");
      onDeleted?.();
    } catch (err) {
      toast((err as Error).message, "error");
      setDeleting(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={remove}
        loading={deleting}
        disabled={!isAdmin}
        icon={<Trash2 className="h-4 w-4" />}
        className="!text-danger hover:!bg-danger-soft"
        title={isAdmin ? "Delete this Shakti Peeth" : "Only an admin can delete a Shakti Peeth"}
      >
        Delete Peeth
      </Button>
      {!isAdmin && (
        <button type="button" onClick={() => setUnlocking(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-faint hover:text-primary">
          <Lock className="h-3.5 w-3.5" /> Admin only · Unlock
        </button>
      )}
      <UnlockAdminDialog open={unlocking} onClose={() => setUnlocking(false)} />
    </div>
  );
}

function UnlockAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Unlock admin" description="Only an admin can delete a Shakti Peeth. Enter the admin password.">
      {open && <UnlockForm onClose={onClose} />}
    </Modal>
  );
}

function UnlockForm({ onClose }: { onClose: () => void }) {
  const { toast } = useFeedback();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // React bubbles through the portal — don't submit the edit form behind this one
    if (!password.trim()) return setError("Please enter the admin password.");
    setBusy(true);
    setError("");
    try {
      await unlockAdmin(password);
      toast("Admin unlocked on this device");
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="admin-pw">Admin password</Label>
        <Input id="admin-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        <FieldError>{error}</FieldError>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} icon={<Lock className="h-4 w-4" />}>
          Unlock
        </Button>
      </div>
    </form>
  );
}

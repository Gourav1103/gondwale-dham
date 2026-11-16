"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };
type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean };

const Ctx = createContext<{
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
} | null>(null);

/** Provides small notifications (toast) and a friendly "Are you sure?" dialog (confirm). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ ...opts, resolve })), []);

  const close = (value: boolean) => {
    ask?.resolve(value);
    setAsk(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-md animate-pop-in items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift"
          >
            {t.kind === "success" && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-saffron" />}
            {t.kind === "error" && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ffb4a3]" />}
            {t.kind === "info" && <Info className="mt-0.5 h-5 w-5 shrink-0 text-saffron-soft" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={!!ask}
        onClose={() => close(false)}
        size="sm"
        title={ask?.title}
        description={ask?.message}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={ask?.danger ? "danger" : "primary"} onClick={() => close(true)} data-autofocus>
              {ask?.confirmLabel ?? "Yes, continue"}
            </Button>
          </>
        }
      />
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFeedback must be used inside ToastProvider");
  return ctx;
}

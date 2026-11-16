"use client";

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

export const inputClass =
  "w-full rounded-2xl border border-line-strong/80 bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint/70 " +
  "transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-saffron/20";

export function Label({ children, hint, htmlFor, required }: { children: ReactNode; hint?: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {children}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </label>
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}

export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

/** Textarea that grows with its content — comfortable on phones. */
export function Textarea({ className = "", value, minRows = 3, ...rest }: ComponentProps<"textarea"> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 560)}px`;
  }, [value]);
  return <textarea ref={ref} rows={minRows} value={value} className={`${inputClass} resize-none leading-relaxed ${className}`} {...rest} />;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[13px] font-medium text-danger">{children}</p>;
}

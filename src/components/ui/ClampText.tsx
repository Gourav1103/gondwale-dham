"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Written out in full so Tailwind generates them.
const CLAMP = { 2: "max-sm:line-clamp-2", 3: "max-sm:line-clamp-3", 6: "max-sm:line-clamp-6" } as const;

/**
 * Long text is cut with "…" after a few lines on phones; "Show more" opens it.
 * Tablets and computers always show everything.
 */
export function ClampText({
  as: Tag = "p",
  lines,
  className = "",
  children,
}: {
  as?: "p" | "h1" | "span";
  lines: keyof typeof CLAMP;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    // Devanagari marks hang a few px outside the line box, so only count a real hidden line.
    const measure = () => {
      const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
      setCut(el.scrollHeight - el.clientHeight > line / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  // A <div> can't sit inside a <p>, so inline text gets a <span> wrapper.
  const Wrap = Tag === "span" ? "span" : "div";
  return (
    <Wrap className="block min-w-0">
      <Tag ref={ref as never} className={`${open ? "" : CLAMP[lines]} ${className}`}>
        {children}
      </Tag>
      {(cut || open) && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-sm font-semibold text-primary sm:hidden">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </Wrap>
  );
}

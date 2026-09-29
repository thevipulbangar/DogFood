"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Tabs with a sliding indicator. Arrow keys move between tabs. */
export function Tabs<T extends string>({ tabs, value, onChange, className, size = "md" }: {
  tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; className?: string; size?: "sm" | "md";
}) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      className={cn("no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line", className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const i = tabs.findIndex((t) => t.id === value);
        const t = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        onChange(t.id);
        (e.currentTarget.querySelector(`[data-tab="${t.id}"]`) as HTMLElement | null)?.focus();
      }}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 px-3 font-mono uppercase tracking-[0.08em] transition-colors",
              size === "sm" ? "h-9 text-[10.5px]" : "h-11 text-[11px]",
              active ? "text-fg" : "text-muted hover:text-fg-2",
            )}
          >
            {t.label}
            {t.count != null && <span className={cn("tabular text-[10px]", active ? "text-accent" : "text-muted")}>{t.count}</span>}
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-x-2 -bottom-px h-px bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

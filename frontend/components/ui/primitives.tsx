"use client";

import { forwardRef, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// ── Button ────────────────────────────────────────────────────

import { buttonClass, type Variant, type Size } from "./button-class";
export { buttonClass };

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant, size, className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
  },
);

/** Subtle magnetic pull toward the cursor. Disabled for reduced motion. */
export function Magnetic({ children, strength = 0.25, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });
  return (
    <motion.span
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
}

// ── Status ────────────────────────────────────────────────────

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "steel";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-fg-2",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  steel: "text-steel",
};
const TONE_BG: Record<Tone, string> = {
  neutral: "bg-white/[0.04] border-line-strong",
  accent: "bg-accent-soft border-accent/30",
  ok: "bg-ok/10 border-ok/25",
  warn: "bg-warn/10 border-warn/25",
  danger: "bg-danger/10 border-danger/25",
  steel: "bg-steel-soft border-steel/25",
};

export function StatusDot({ tone = "ok", pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block size-1.5 shrink-0 rounded-full bg-current", TONE_TEXT[tone], pulse && "animate-pulse-dot", className)} />
  );
}

export function Badge({ tone = "neutral", dot, pulse, children, className }: { tone?: Tone; dot?: boolean; pulse?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-xs border px-1.5 font-mono text-[10px] uppercase tracking-[0.08em]", TONE_BG[tone], TONE_TEXT[tone], className)}>
      {dot && <StatusDot tone={tone} pulse={pulse} />}
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-line-strong bg-surface-2 px-1 font-mono text-[10px] text-fg-2", className)}>
      {children}
    </kbd>
  );
}

export function Avatar({ initials, size = 28, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface-3 font-mono font-medium text-fg-2", className)}
    >
      {initials}
    </span>
  );
}

// ── Containers ────────────────────────────────────────────────

/** Corner registration marks — a recurring technical detail. */
export function Ticks({ className }: { className?: string }) {
  const c = "absolute size-2 border-fg/30";
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <span className={cn(c, "-left-px -top-px border-l border-t")} />
      <span className={cn(c, "-right-px -top-px border-r border-t")} />
      <span className={cn(c, "-bottom-px -left-px border-b border-l")} />
      <span className={cn(c, "-bottom-px -right-px border-b border-r")} />
    </span>
  );
}

export function Panel({
  title, meta, action, ticks, children, className, bodyClassName, as: Tag = "section",
}: {
  title?: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode; ticks?: boolean;
  children: React.ReactNode; className?: string; bodyClassName?: string; as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("relative rounded-md border border-line bg-surface/70", className)}>
      {ticks && <Ticks />}
      {(title || action) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4">
          <div className="flex min-w-0 items-center gap-3">
            {title && <h2 className="label truncate text-fg-2">{title}</h2>}
            {meta && <span className="label truncate">{meta}</span>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Tag>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("relative overflow-hidden rounded-sm bg-white/[0.04] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.05] before:to-transparent", className)} />;
}

/** Animated horizontal meter. */
export function Meter({ value, tone = "accent", className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const bg: Record<Tone, string> = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", neutral: "bg-fg-2", steel: "bg-steel" };
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className={cn("h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]", className)}>
      <motion.div
        className={cn("h-full rounded-full", bg[tone])}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

// ── Form fields ───────────────────────────────────────────────

export const fieldClass = cn(
  "w-full rounded-sm border border-line-strong bg-bg/60 px-3 text-[14px] text-fg placeholder:text-muted",
  "transition-colors duration-150 hover:border-fg/25 focus:border-accent focus:outline-none focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
);

export function Field({ label, hint, error, htmlFor, children, className, required }: {
  label: string; hint?: React.ReactNode; error?: string; htmlFor: string; children: React.ReactNode; className?: string; required?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="label text-fg-2">
          {label}{required && <span className="text-accent" aria-hidden> *</span>}
        </label>
        {hint && <span className="label normal-case tracking-normal">{hint}</span>}
      </div>
      {children}
      {error && <p id={`${htmlFor}-error`} role="alert" className="font-mono text-[11px] text-danger">{error}</p>}
    </div>
  );
}

/** Mono key/value row used for technical metadata. */
export function Meta({ k, v, className }: { k: string; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0", className)}>
      <dt className="label">{k}</dt>
      <dd className="truncate text-right font-mono text-[12px] text-fg">{v}</dd>
    </div>
  );
}

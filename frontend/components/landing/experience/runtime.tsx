"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  animate, useMotionValue, useSpring,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

// ── Math ──────────────────────────────────────────────────────

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Normalized position of `v` inside [a, b], clamped. */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const expoOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_IO = [0.76, 0, 0.24, 1] as const;

// ── Experience context ────────────────────────────────────────

type Env = {
  /** Loader finished — scenes may start their intro choreography. */
  ready: boolean;
  setReady: (v: boolean) => void;
  /** User asked for reduced motion: no autonomous movement, no pinning. */
  still: boolean;
  /** Narrow viewport: simplified choreography, fewer elements. */
  compact: boolean;
  /** Pointer in -1..1 viewport space, springed. */
  px: MotionValue<number>;
  py: MotionValue<number>;
  /** Raw pointer in CSS pixels (for canvases). */
  pointer: React.RefObject<{ x: number; y: number; active: boolean }>;
  /**
   * Scenes are composed on a stage at least STAGE_H tall and scaled down
   * uniformly on shorter viewports, so no composition collides on a laptop.
   * Pointer maths inside a scene divides by this.
   */
  scale: number;
};

/** The height every scene is composed for. */
const STAGE_H = 900;

const Ctx = createContext<Env | null>(null);
export const useEnv = () => useContext(Ctx)!;

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  // Read after hydration (not during it) so server and client markup agree.
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const compact = useMedia("(max-width: 767px)");
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 60, damping: 18, mass: 0.6 });
  const py = useSpring(rawY, { stiffness: 60, damping: 18, mass: 0.6 });
  const pointer = useRef({ x: -9999, y: -9999, active: false });
  const [vh, setVh] = useState(STAGE_H);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const scale = compact ? 1 : clamp(vh / STAGE_H, 0.68, 1);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.current = { x: e.clientX, y: e.clientY, active: true };
      rawX.set((e.clientX / window.innerWidth) * 2 - 1);
      rawY.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    const leave = () => {
      pointer.current.active = false;
      rawX.set(0);
      rawY.set(0);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [rawX, rawY]);

  const env = useMemo(() => ({ ready, setReady, still, compact, px, py, pointer, scale }), [ready, still, compact, px, py, scale]);
  return <Ctx.Provider value={env}>{children}</Ctx.Provider>;
}

// ── Scene: a full-viewport stage that plays its timeline on arrival ──

/** Scene edges dissolve over 56px, so one section flows into the next with no seam. */
const EDGE = "linear-gradient(to bottom, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%)";
const EDGE_FADE: React.CSSProperties = { maskImage: EDGE, WebkitMaskImage: EDGE };

export type Playhead = {
  /** The timeline position, 0..1. Scene code reads only this. */
  progress: MotionValue<number>;
  /** The scene is (mostly) on screen. */
  active: boolean;
  /** Tween the timeline to `to` over `duration` seconds (instant with reduced motion). */
  go: (to: number, duration?: number) => void;
};

/**
 * A normal-height section — the page scrolls like a page, nothing is pinned.
 * Each scene owns a 0..1 timeline. With `play`, it runs once, on its own clock,
 * the first time the scene comes into view; interactive scenes drive it
 * themselves through the playhead. Reduced motion jumps straight to `rest`,
 * the most informative moment.
 */
export function Scene({ id, nav, rest, play, className, children }: {
  id: string;
  nav: string;
  rest: number;
  play?: { to: number; duration: number };
  className?: string;
  children: (progress: MotionValue<number>, playhead: Playhead) => React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const { still, scale } = useEnv();
  const progress = useMotionValue(0);
  const [active, setActive] = useState(false);
  const anim = useRef<ReturnType<typeof animate> | null>(null);
  const played = useRef(false);

  const go = useCallback((to: number, duration = 1.2) => {
    anim.current?.stop();
    if (still) { progress.set(to); return; }
    anim.current = animate(progress, to, { duration, ease: "linear" });
  }, [still, progress]);

  useEffect(() => {
    if (still) progress.set(rest);
  }, [still, rest, progress]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active || !play || played.current || still) return;
    played.current = true;
    go(play.to, play.duration);
  }, [active, play, go, still]);

  useEffect(() => () => anim.current?.stop(), []);

  const playhead = useMemo(() => ({ progress, active, go }), [progress, active, go]);

  return (
    <section ref={ref} id={id} data-nav={nav} className={cn("relative h-[100svh] min-h-[600px] overflow-hidden", className)} style={EDGE_FADE}>
      {scale < 1 ? (
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})` }}>
          {children(progress, playhead)}
        </div>
      ) : children(progress, playhead)}
    </section>
  );
}

/**
 * Mirror a scroll motion value into a plain JS one. Motion would otherwise try
 * to hardware-accelerate scroll-linked opacity onto a native ScrollTimeline,
 * which does not honour element-relative offsets consistently across scenes.
 * `pin` freezes the output (reduced motion).
 */
export function useRelay(source: MotionValue<number>, pin?: number) {
  const out = useMotionValue(pin ?? 0);
  useEffect(() => {
    if (pin != null) { out.set(pin); return; }
    out.set(source.get());
    return source.on("change", (v) => out.set(v));
  }, [source, pin, out]);
  return out;
}

/** Subscribe a callback to a motion value (and call it once immediately). */
export function useProgress(mv: MotionValue<number>, fn: (v: number) => void, deps: unknown[] = []) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    f.current(mv.get());
    return mv.on("change", (v) => f.current(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mv, ...deps]);
}

/** True while `ref` is within (or near) the viewport — used to park rAF loops. */
export function useOnScreen(ref: React.RefObject<Element | null>, margin = "200px") {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: margin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, margin]);
  return on;
}

/** Element size, kept current. */
export function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// ── Text ──────────────────────────────────────────────────────

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—";

/** Decodes text through random glyphs whenever `text` changes. */
export function Scramble({ text, className, duration = 520 }: { text: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { still } = useEnv();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (still) { el.textContent = text; return; }
    const from = el.textContent ?? "";
    const len = Math.max(from.length, text.length);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = clamp((t - t0) / duration);
      let out = "";
      for (let i = 0; i < len; i++) {
        const settle = (i / len) * 0.6 + 0.4;
        if (k >= settle) out += text[i] ?? "";
        else if (k > settle - 0.4) out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        else out += from[i] ?? "";
      }
      el.textContent = out;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration, still]);
  return <span ref={ref} className={className} aria-label={text}>{text}</span>;
}

/** Character-by-character reveal driven by a 0..1 motion value. */
export function ScrubText({ text, progress, className, charClassName }: {
  text: string; progress: MotionValue<number>; className?: string; charClassName?: string;
}) {
  const words = useMemo(() => text.split(" ").map((w) => Array.from(w)), [text]);
  const chars = useMemo(() => words.flat(), [words]);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useProgress(progress, (p) => {
    const n = chars.length;
    refs.current.forEach((el, i) => {
      if (!el) return;
      const t = clamp(p * (n + 6) - i, 0, 6) / 6;
      el.style.opacity = String(0.08 + t * 0.92);
      el.style.transform = `translate3d(0, ${(1 - easeOut(t)) * 0.35}em, 0)`;
    });
  });
  let k = 0;
  return (
    <span className={className} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi}>
          <span aria-hidden className="inline-block whitespace-nowrap">
            {w.map((c) => {
              const i = k++;
              return <span key={i} ref={(el) => { refs.current[i] = el; }} className={cn("inline-block will-change-transform", charClassName)}>{c}</span>;
            })}
          </span>
          {wi < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/** A thin technical label: `[ 01 ] TEXT`. */
export function Tag({ n, children, className }: { n?: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted", className)}>
      {n && <span className="text-fg-2">{n}</span>}
      {n && <span className="h-px w-5 bg-line-strong" />}
      {children}
    </span>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useTransform, type MotionValue } from "motion/react";
import { EVENT } from "@/lib/data";
import { mulberry32, pad } from "@/lib/utils";
import { StatusDot } from "@/components/ui/primitives";
import { PIPELINE, RUBRIC } from "./story";
import type { Shot } from "./ProductFrame";
import { Scene, Scramble, Tag, type Playhead, easeInOut, lerp, range, useEnv, useOnScreen, useProgress, useSize } from "./runtime";

// Heavy: the real app screens. Split out and only loaded as the scene approaches.
const ProductFrame = dynamic(() => import("./ProductFrame"), { ssr: false });

const SHOTS: (Shot & { url: string; k: string; d: string })[] = [
  { screen: 0, target: "top", url: "dashboard", k: "Mission control for hackathons.", d: "One operations surface for every role. Participants see their team and deadline. Judges see their queue. Organizers see everything — with the audit trail to prove it." },
  { screen: 0, target: "metrics", url: "dashboard", k: "The event, counted.", d: "Projects, teams, judges, submissions and judging coverage — straight from the event's own records." },
  { screen: 0, target: { titles: ["Submission timeline", "Judge completion"] }, url: "dashboard", k: "Submissions and judge progress.", d: "Cumulative submissions since kickoff, and completion for every judge on the panel." },
  { screen: 0, target: { titles: ["Live activity", "Needs attention"] }, url: "dashboard", k: "Nothing happens off the record.", d: "Every state change is written to the audit trail. Flagged scores, late drafts and blocked voting anomalies surface on their own." },
  { screen: 1, target: "top", url: "analytics", k: "Analytics, for organizers.", d: "Timelines, completion, score distribution and criterion averages — all computed locally." },
  { screen: 1, target: { titles: ["Normalization impact"] }, url: "analytics", k: "The collision, for every project.", d: "What happened to one project's score a moment ago, shown for the top ten: raw means against normalized ones." },
  { screen: 0, target: "top", url: "dashboard", k: "One system, end to end.", d: "Submission, evaluation, normalization and results — in a single self-hosted instance you control." },
];
const FORM = 0.26;   // fragments → frame
const TOUR = [0.3, 0.97] as const;

export function RevealScene() {
  return (
    <Scene id="platform" nav="07 / PLATFORM" rest={shotAt(0)}>
      {(p, ph) => <Reveal p={p} ph={ph} />}
    </Scene>
  );
}

/** Timeline position of tour chapter `k`. */
function shotAt(k: number) {
  const segs = SHOTS.length - 1;
  return k === 0 ? TOUR[0] + 0.02 : TOUR[0] + (k / segs) * (TOUR[1] - TOUR[0]);
}
const DWELL = 4600;

function Reveal({ p, ph }: { p: MotionValue<number>; ph: Playhead }) {
  const { compact } = useEnv();
  const stage = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const near = useOnScreen(stage, "150% 0px");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (near) setMounted(true); }, [near]);
  const frameEl = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState(0);

  // Arrive: the pieces assemble into the frame. Then the tour pages itself; a click takes over.
  const target = useRef(-1);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!ph.active || !auto) return;
    let id = 0;
    const next = () => {
      if (target.current >= SHOTS.length - 1) return;
      target.current += 1;
      ph.go(shotAt(target.current), 1.8);
      id = window.setTimeout(next, DWELL);
    };
    if (target.current < 0) { target.current = 0; ph.go(shotAt(0), 3.2); id = window.setTimeout(next, 3200 + DWELL); }
    else id = window.setTimeout(next, DWELL);
    return () => window.clearTimeout(id);
  }, [ph, auto]);
  const select = (k: number) => {
    setAuto(false);
    const from = Math.max(0, target.current);
    target.current = k;
    ph.go(shotAt(k), 1.2 + 0.3 * Math.abs(k - from));
  };
  const frags = useRef<(HTMLDivElement | null)[]>([]);
  const outline = useRef<SVGRectElement>(null);

  // Frame box, in stage pixels. The frame opens up once the tour starts.
  const box = (v: number) => {
    const open = easeInOut(range(v, FORM + 0.02, TOUR[0] + 0.02));
    const side = compact ? 12 : Math.max(24, w * 0.05);
    const top = lerp(h * 0.3, compact ? 96 : 104, open);
    // leave a subtitle band under the frame for the guided annotations
    const bottom = lerp(compact ? h * 0.24 : h * 0.1, compact ? 262 : 176, open);
    return { x: side, y: top, w: w - side * 2, h: h - top - bottom };
  };

  const pieces = useMemo(() => {
    const r = mulberry32(7);
    const n = compact ? 18 : 34;
    return Array.from({ length: n }, (_, i) => {
      const kind = (["card", "score", "crit", "dot", "line", "dot"] as const)[i % 6];
      const a = r() * Math.PI * 2;
      return {
        kind, a, dist: 0.7 + r() * 0.5, rot: (r() - 0.5) * 90, delay: r() * 0.35, perim: i / n,
        label: kind === "card" ? PIPELINE[i % PIPELINE.length].name : kind === "score" ? PIPELINE[(i * 3) % PIPELINE.length].score.toFixed(2) : RUBRIC[i % RUBRIC.length].name.toUpperCase(),
      };
    });
  }, [compact]);

  useProgress(p, (v) => {
    if (!w) return;
    const b = box(v);
    const per = 2 * (b.w + b.h);
    if (frameEl.current) {
      const st = frameEl.current.style;
      st.left = `${b.x}px`; st.top = `${b.y}px`; st.width = `${b.w}px`; st.height = `${b.h}px`;
    }
    pieces.forEach((f, i) => {
      const el = frags.current[i];
      if (!el) return;
      const t = easeInOut(range(v, f.delay * 0.12, 0.13 + f.delay * 0.08));
      // target: a point on the frame's perimeter
      let d = f.perim * per, tx: number, ty: number;
      if (d < b.w) { tx = b.x + d; ty = b.y; }
      else if ((d -= b.w) < b.h) { tx = b.x + b.w; ty = b.y + d; }
      else if ((d -= b.h) < b.w) { tx = b.x + b.w - d; ty = b.y + b.h; }
      else { d -= b.w; tx = b.x; ty = b.y + b.h - d; }
      const R = Math.hypot(w, h) * f.dist;
      const sx = w / 2 + Math.cos(f.a) * R, sy = h / 2 + Math.sin(f.a) * R;
      const x = lerp(sx, tx, t), y = lerp(sy, ty, t);
      const settle = range(v, 0.15, 0.22);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${(f.rot * (1 - t)).toFixed(1)}deg) scale(${(1 - settle * 0.7).toFixed(3)})`;
      el.style.opacity = String(Math.min(1, t * 3) * (1 - settle));
    });
    if (outline.current) {
      const draw = range(v, 0.13, 0.22);
      outline.current.setAttribute("x", String(b.x)); outline.current.setAttribute("y", String(b.y));
      outline.current.setAttribute("width", String(b.w)); outline.current.setAttribute("height", String(b.h));
      outline.current.style.strokeDasharray = `${per}`;
      outline.current.style.strokeDashoffset = `${per * (1 - draw)}`;
      outline.current.style.opacity = String(1 - range(v, FORM, FORM + 0.03));
    }
    const segs = SHOTS.length - 1;
    const t = range(v, ...TOUR) * segs;
    const s = Math.min(segs, Math.round(t - 0.15));
    setShot((cur) => (cur === Math.max(0, s) ? cur : Math.max(0, s)));
  }, [w, h, compact, pieces]);

  const tour = useTransform(p, [TOUR[0], TOUR[1]], [0, 1]);
  const clipPath = useTransform(p, [0.2, FORM], ["inset(50% 50% 50% 50%)", "inset(0% 0% 0% 0%)"]);
  const titleOpacity = useTransform(p, [0.12, 0.2, FORM + 0.02, TOUR[0]], [0, 1, 1, 0]);
  const noteOpacity = useTransform(p, [TOUR[0] - 0.01, TOUR[0] + 0.03, 0.985, 1], [0, 1, 1, 1]);
  const cur = SHOTS[shot];
  const last = shot === SHOTS.length - 1;

  return (
    <div ref={stage} className="relative h-full w-full">
      {/* fragments of everything seen so far, returning */}
      {pieces.map((f, i) => (
        <div key={i} ref={(el) => { frags.current[i] = el; }} aria-hidden className="pointer-events-none absolute left-0 top-0 will-change-transform" style={{ opacity: 0 }}>
          {f.kind === "card" && (
            <div className="w-[130px] rounded-[3px] border border-line-strong bg-surface p-2">
              <p className="font-mono text-[8px] tracking-[0.1em] text-muted">SUBMISSION</p>
              <p className="truncate text-[12px] font-semibold text-fg">{f.label}</p>
              <div className="mt-1.5 h-px bg-accent/60" />
            </div>
          )}
          {f.kind === "score" && <span className="font-mono text-[22px] tabular text-fg">{f.label}</span>}
          {f.kind === "crit" && <span className="border border-line-strong px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-fg-2">{f.label}</span>}
          {f.kind === "dot" && <span className="block size-1.5 bg-accent" />}
          {f.kind === "line" && <span className="block h-px w-16 bg-fg-2" />}
        </div>
      ))}

      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
        <rect ref={outline} fill="none" stroke="var(--color-accent)" strokeWidth="1" style={{ strokeDasharray: 5000, strokeDashoffset: 5000 }} />
      </svg>

      <motion.div className="pointer-events-none absolute inset-x-0 top-[84px] z-10 mx-auto max-w-[1600px] px-5 md:top-[96px] md:px-10" style={{ opacity: titleOpacity }}>
        <Tag n="07">The transformation</Tag>
        <h2 className="mt-3 max-w-[20ch] text-[clamp(1.9rem,4.4vw,4.2rem)] font-semibold leading-[0.9] tracking-[-0.05em]">
          Everything you just saw is the platform<span className="text-accent">.</span>
        </h2>
      </motion.div>

      {/* the real product */}
      <motion.div ref={frameEl} className="ink absolute overflow-hidden rounded-[6px] border border-line-strong bg-bg shadow-[0_60px_160px_-40px_rgb(255_90_31/0.14)] [--color-fg-2:#b5b4ae] [--color-muted:#7f7e79]" style={{ clipPath }}>
        <div className="relative z-10 flex h-9 items-center gap-2 border-b border-line bg-bg px-3 md:px-4">
          {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-fg/15" />)}
          <span className="ml-3 font-mono text-[10.5px] text-muted">{EVENT.instance}/<Scramble text={cur.url} /></span>
          <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-ok"><StatusDot tone="ok" pulse />LIVE COMPONENTS</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 top-9">
          {mounted ? <ProductFrame tour={tour} shots={SHOTS} /> : <div className="h-full w-full bg-bg" />}
        </div>
      </motion.div>

      {/* guided annotations — a subtitle band under the frame, never over the product */}
      <motion.aside className="absolute inset-x-3 bottom-14 z-20 md:inset-x-[max(24px,5vw)] md:bottom-16" style={{ opacity: noteOpacity }}>
        <div className="flex gap-1">
          {SHOTS.map((s, i) => (
            <button key={i} type="button" onClick={() => select(i)} aria-label={`Chapter ${i + 1}: ${s.k}`} aria-pressed={i === shot}
              className="group -my-2 flex-1 py-2">
              <span className="block h-[2px] transition-[background-color,transform] duration-300 group-hover:scale-y-[2]" style={{ backgroundColor: i <= shot ? "var(--color-accent)" : "rgb(var(--fg-rgb) / 0.16)" }} />
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-x-10 gap-y-1.5 md:mt-4 md:grid-cols-[190px_minmax(0,1fr)_minmax(0,1.3fr)] md:items-start">
          <p className="whitespace-nowrap font-mono text-[10px] tracking-[0.14em] text-muted md:pt-1.5">
            07.{pad(shot + 1, 2)} / {pad(SHOTS.length, 2)} <span className="text-fg-2">· {cur.url.toUpperCase()}</span>
          </p>
          <p key={cur.k} className="text-[18px] font-semibold leading-tight tracking-[-0.02em] text-fg md:text-[22px]">{cur.k}</p>
          <p className="text-[13px] leading-relaxed text-fg-2 md:text-[14px]">{cur.d}</p>
        </div>
      </motion.aside>
    </div>
  );
}

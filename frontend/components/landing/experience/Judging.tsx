"use client";

import { useRef } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { pad } from "@/lib/utils";
import { FEATURED_CRITERIA } from "./story";
import { Dossier } from "./Dossier";
import { Scene, Tag, easeInOut, easeOut, lerp, range, useEnv, useProgress, useSize } from "./runtime";

const START = 0.08;
const SPAN = 0.19;
const win = (k: number) => {
  const s = START + k * SPAN;
  return { enter: [s, s + 0.05], link: [s + 0.035, s + 0.08], eval: [s + 0.07, s + 0.17] } as const;
};

export function JudgingScene() {
  return (
    <Scene id="evaluation" nav="03 / EVALUATION" rest={0.895} play={{ to: 0.895, duration: 6.5 }}>
      {(p) => <Judging p={p} />}
    </Scene>
  );
}

function Judging({ p }: { p: MotionValue<number> }) {
  const { compact } = useEnv();
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const cs = useSize(card);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const packets = useRef<(SVGRectElement | null)[]>([]);
  const states = useRef<(HTMLSpanElement | null)[]>([]);
  const outline = useRef<SVGRectElement>(null);

  const fill = useTransform(p, (v) => FEATURED_CRITERIA.reduce((s, _, k) => s + range(v, ...win(k).eval), 0));

  const cx = w / 2, cy = h / 2;
  const cw = cs.w * (compact ? 0.82 : 1), ch = cs.h * (compact ? 0.82 : 1);
  const home = (k: number) =>
    compact
      ? { x: w * [0.14, 0.38, 0.62, 0.86][k], y: cy - ch / 2 - 64 }
      : { x: cx + [-1, 1, 1, -1][k] * Math.min(w * 0.3, cw / 2 + 300), y: cy + 60 + [-1, -1, 1, 1][k] * Math.min(h * 0.19, 168) };
  const attach = (k: number) =>
    compact
      ? { x: cx + [-0.36, -0.12, 0.12, 0.36][k] * cw, y: cy - ch / 2 }
      : { x: cx + [-1, 1, 1, -1][k] * (cw / 2), y: cy + [-0.28, -0.28, 0.2, 0.2][k] * ch };
  const pathFor = (k: number) => {
    const a = home(k), b = attach(k);
    if (compact) return `M${a.x},${a.y + 22} C${a.x},${a.y + 50} ${b.x},${b.y - 30} ${b.x},${b.y}`;
    const mx = lerp(a.x, b.x, 0.55);
    return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  };

  useProgress(p, (v) => {
    if (!w) return;
    const gather = easeInOut(range(v, 0.9, 0.99));
    FEATURED_CRITERIA.forEach((c, k) => {
      const W = win(k);
      const enter = easeOut(range(v, ...W.enter));
      const link = range(v, ...W.link);
      const ev = range(v, ...W.eval);
      const a = home(k);
      const far = compact ? { x: a.x, y: a.y - 120 } : { x: a.x + (a.x - cx) * 0.9, y: a.y + (a.y - cy) * 0.6 };
      // approach → plug in (pull toward the card while evaluating) → settle → gather into the card
      const pull = Math.sin(Math.PI * ev) * 0.12;
      let x = lerp(far.x, a.x, enter), y = lerp(far.y, a.y, enter);
      x = lerp(x, cx, pull + gather * 0.9);
      y = lerp(y, cy, pull + gather * 0.9);
      const el = nodes.current[k];
      if (el) {
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(1 - gather * 0.6).toFixed(3)})`;
        el.style.opacity = String(enter * (1 - gather));
        el.dataset.state = ev >= 1 ? "done" : ev > 0 ? "live" : "idle";
      }
      if (states.current[k]) states.current[k]!.textContent = ev >= 1 ? "SCORED" : ev > 0 ? "EVALUATING" : enter > 0.9 ? "CONNECTED" : "INCOMING";

      const path = paths.current[k];
      if (path) {
        const len = path.getTotalLength();
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len * (1 - link) + len * gather}`;
        path.style.opacity = String(1 - gather);
        path.style.stroke = ev > 0 && ev < 1 ? "var(--color-accent)" : "rgb(var(--fg-rgb) / 0.28)";
        const pk = packets.current[k];
        if (pk) {
          const t = (ev * 3) % 1;
          const pt = path.getPointAtLength(len * t);
          pk.setAttribute("x", String(pt.x - 2));
          pk.setAttribute("y", String(pt.y - 2));
          pk.style.opacity = ev > 0 && ev < 1 ? "1" : "0";
        }
      }
    });
    const o = outline.current;
    if (o) {
      const len = 2 * (cw + 32) + 2 * (ch + 32); // the outline's true perimeter
      const k = range(v, 0.82, 0.9);
      o.style.strokeDasharray = `${len}`;
      o.style.strokeDashoffset = `${len * (1 - k)}`;
      o.style.opacity = String(1 - range(v, 0.95, 1));
    }
  }, [w, h, cs.w, cs.h, compact]);

  const headOpacity = useTransform(p, [0, 0.06], [0, 1]);
  const titleOpacity = headOpacity;
  const doneOpacity = useTransform(p, [0.84, 0.9, 0.96, 1], [0, 1, 1, 0]);

  return (
    <div ref={stage} className="relative h-full w-full">
      <motion.div className="pointer-events-none absolute inset-x-0 top-[76px] z-10 mx-auto flex max-w-[1600px] items-start justify-between gap-6 px-5 md:top-[92px] md:px-10" style={{ opacity: headOpacity }}>
        <motion.div className={compact ? "hidden" : ""} style={{ opacity: titleOpacity }}>
          <Tag n="03">Judging engine</Tag>
          <h2 className="mt-3 max-w-[14ch] text-[clamp(1.8rem,3.6vw,3.4rem)] font-semibold leading-[0.92] tracking-[-0.045em]">Criteria meet the work.</h2>
        </motion.div>
        <p className={`max-w-[34ch] text-[14px] leading-relaxed text-fg-2 md:text-right ${compact ? "hidden" : ""}`}>
          Judges score assigned projects against a weighted rubric in a focused, keyboard-first console.
        </p>
      </motion.div>

      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {w > 0 && FEATURED_CRITERIA.map((c, k) => (
          <g key={c.id}>
            <path ref={(el) => { paths.current[k] = el; }} d={pathFor(k)} fill="none" strokeWidth="1" style={{ strokeDasharray: 4000, strokeDashoffset: 4000 }} />
            <rect ref={(el) => { packets.current[k] = el; }} width="4" height="4" fill="var(--color-accent)" style={{ opacity: 0 }} />
          </g>
        ))}
        {cw > 0 && (
          <rect ref={outline} x={cx - cw / 2 - 16} y={cy - ch / 2 - 16} width={cw + 32} height={ch + 32} fill="none" stroke="var(--color-accent)" strokeWidth="1" style={{ strokeDasharray: 4000, strokeDashoffset: 4000 }} />
        )}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <div ref={card} className={compact ? "scale-[0.82]" : ""}>
          <Dossier fill={fill} />
        </div>
      </div>

      {FEATURED_CRITERIA.map((c, k) => (
        <div key={c.id} ref={(el) => { nodes.current[k] = el; }} data-state="idle"
          className="group absolute left-0 top-0 z-10 w-[88px] rounded-[3px] border border-line-strong bg-surface px-2 py-1.5 will-change-transform data-[state=live]:border-accent md:w-[214px] md:px-3 md:py-2.5"
          style={{ opacity: 0 }}>
          <p className="flex justify-between font-mono text-[8.5px] tracking-[0.12em] text-muted md:text-[9.5px]">
            <span>C-{pad(k + 1, 2)}</span>
          </p>
          <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.02em] text-fg md:text-[15px] md:tracking-[-0.01em]">{c.name}</p>
          <p className="mt-1.5 hidden text-[11px] leading-snug text-muted md:block">{c.description}</p>
          <p className="mt-2 flex items-center gap-1.5 border-t border-line pt-1.5 font-mono text-[9px] tracking-[0.12em] text-muted group-data-[state=live]:text-accent group-data-[state=done]:text-fg-2">
            <span className="size-1.5 rounded-full bg-current" />
            <span ref={(el) => { states.current[k] = el; }}>INCOMING</span>
          </p>
        </div>
      ))}

      <motion.p className="pointer-events-none absolute inset-x-0 bottom-[7%] text-center font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent" style={{ opacity: doneOpacity }}>
        ● Project understood · {FEATURED_CRITERIA.length} criteria · weighted
      </motion.p>
    </div>
  );
}

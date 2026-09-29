"use client";

import { useRef } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { pad } from "@/lib/utils";
import { FEATURED, FEATURED_CRITERIA } from "./story";
import { Dossier } from "./Dossier";
import { Scene, Tag, clamp, easeInOut, easeOut, lerp, range, useEnv, useProgress, useSize } from "./runtime";

const SHORT = ["INN", "EXE", "IMP", "DES"];

/** Where each judge's stream originates — shared with the collision scene so numbers hand off in place. */
export function judgeAnchor(j: number, n: number, w: number, h: number, compact: boolean) {
  if (compact) return { x: w * ((j + 0.5) / n), y: h * 0.22 };
  return { x: w * 0.17, y: h * (0.58 + (j - (n - 1) / 2) * 0.19) };
}

export function PanelScene() {
  return (
    <Scene id="judges" nav="04 / JUDGES" rest={0.83} play={{ to: 0.83, duration: 5.5 }}>
      {(p) => <Panel p={p} />}
    </Scene>
  );
}

function Panel({ p }: { p: MotionValue<number> }) {
  const { compact } = useEnv();
  const stage = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const cardWrap = useRef<HTMLDivElement>(null);
  const cardSize = useSize(cardWrap);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const packets = useRef<(HTMLSpanElement | null)[]>([]);
  const heads = useRef<(HTMLDivElement | null)[]>([]);
  const bigs = useRef<(HTMLDivElement | null)[]>([]);
  const judges = FEATURED.judges;
  const n = judges.length;

  const full = useMotionValue(4);
  const ticks = useTransform(p, [0.3, 0.82], [0, 1]);

  const scale = compact ? 0.62 : 1;
  const cw = cardSize.w * scale, ch = cardSize.h * scale;
  const cardAt = (v: number) => {
    const m = easeInOut(range(v, 0.02, 0.16));
    const to = compact ? { x: w / 2, y: h * 0.64 } : { x: w * 0.68, y: h / 2 };
    return { x: lerp(w / 2, to.x, m), y: lerp(h / 2, to.y, m) };
  };
  const endCard = cardAt(1);
  const pathFor = (j: number) => {
    const a = judgeAnchor(j, n, w, h, compact);
    if (compact) {
      const b = { x: endCard.x + (j - (n - 1) / 2) * cw * 0.3, y: endCard.y - ch / 2 };
      const bend = [-60, 40, 80][j % 3];
      return `M${a.x},${a.y + 36} C${a.x + bend},${a.y + 120} ${b.x - bend},${b.y - 90} ${b.x},${b.y}`;
    }
    const b = { x: endCard.x - cw / 2, y: endCard.y + (j - (n - 1) / 2) * ch * 0.28 };
    const sx = a.x + 140;
    // each judge takes a different route: arc over, direct S, loop under
    const shapes = [
      `M${sx},${a.y} C${sx + 220},${a.y - 140} ${b.x - 260},${b.y - 160} ${b.x},${b.y}`,
      `M${sx},${a.y} C${sx + 180},${a.y + 90} ${b.x - 200},${b.y - 90} ${b.x},${b.y}`,
      `M${sx},${a.y} C${sx + 320},${a.y + 200} ${b.x - 120},${b.y + 180} ${b.x},${b.y}`,
    ];
    return shapes[j % 3];
  };

  useProgress(p, (v) => {
    if (!w) return;
    const c = cardAt(v);
    if (cardWrap.current) {
      const out = easeInOut(range(v, 0.86, 0.96));
      const sc = compact ? lerp(0.82, scale, easeInOut(range(v, 0.02, 0.16))) : 1;
      cardWrap.current.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) translate(-50%, -50%) scale(${(sc * (1 - out * 0.2)).toFixed(3)})`;
      cardWrap.current.style.opacity = String(1 - out);
    }
    const handoff = easeInOut(range(v, 0.86, 0.97));
    judges.forEach((jd, j) => {
      const head = heads.current[j];
      const intro = easeOut(range(v, 0.08 + j * 0.04, 0.2 + j * 0.04));
      if (head) {
        head.style.opacity = String(intro * (1 - handoff));
        head.style.transform = `translate3d(0, ${(1 - intro) * 16}px, 0)`;
      }
      const big = bigs.current[j];
      if (big) {
        big.style.opacity = String(handoff);
        big.style.transform = `translate(-50%, -50%) scale(${lerp(0.35, 1, handoff).toFixed(3)})`;
      }
      const path = paths.current[j];
      if (!path) return;
      const len = path.getTotalLength();
      const draw = range(v, 0.12 + j * 0.04, 0.3 + j * 0.04);
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len * (1 - draw)}`;
      path.style.opacity = String(1 - handoff);
      const travel = range(v, 0.26 + j * 0.05, 0.7 + j * 0.05);
      FEATURED_CRITERIA.forEach((_, k) => {
        const el = packets.current[j * 4 + k];
        if (!el) return;
        const t = clamp(travel * 1.45 - k * 0.15);
        const pt = path.getPointAtLength(len * easeInOut(t));
        el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%)`;
        el.style.opacity = String(t > 0 && t < 1 ? 1 : 0);
      });
    });
  }, [w, h, cw, ch, compact]);

  const headOpacity = useTransform(p, [0, 0.08, 0.84, 0.9], [0, 1, 1, 0]);
  const mergeOpacity = useTransform(p, [0.74, 0.8, 0.86, 0.9], [0, 1, 1, 0]);

  return (
    <div ref={stage} className="relative h-full w-full">
      <motion.div className="pointer-events-none absolute inset-x-0 top-[76px] z-10 mx-auto flex max-w-[1600px] items-start justify-between gap-6 px-5 md:top-[92px] md:px-10" style={{ opacity: headOpacity }}>
        <div className={compact ? "hidden" : ""}>
          <Tag n="04">Multi-judge panel</Tag>
          <h2 className="mt-3 max-w-[16ch] text-[clamp(1.8rem,3.6vw,3.4rem)] font-semibold leading-[0.92] tracking-[-0.045em]">Many perspectives. One structured evaluation.</h2>
        </div>
        <p className={`max-w-[34ch] text-[14px] leading-relaxed text-fg-2 md:text-right ${compact ? "hidden" : ""}`}>
          Every assigned judge scores independently. Their evaluations stream into a single record — spread and all.
        </p>
      </motion.div>

      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {w > 0 && cw > 0 && judges.map((j, i) => (
          <path key={j.id} ref={(el) => { paths.current[i] = el; }} d={pathFor(i)} fill="none" stroke="rgb(var(--fg-rgb) / 0.22)" strokeWidth="1" style={{ strokeDasharray: 4000, strokeDashoffset: 4000 }} />
        ))}
      </svg>

      {/* judge heads */}
      {w > 0 && judges.map((j, i) => {
        const a = judgeAnchor(i, n, w, h, compact);
        return (
          <div key={j.id}>
            <div ref={(el) => { heads.current[i] = el; }} className="absolute" style={{ left: compact ? a.x : a.x - 110, top: a.y, opacity: 0, width: compact ? 104 : 250, marginLeft: compact ? -52 : 0, marginTop: compact ? -20 : -34 }}>
              <p className="font-mono text-[9px] tracking-[0.14em] text-accent md:text-[10px]">{j.id}</p>
              <p className="mt-1 truncate text-[12px] font-semibold text-fg md:text-[16px]">{j.name}</p>
              <p className="hidden truncate text-[11.5px] text-muted md:block">{j.title}</p>
              <p className="mt-1.5 flex items-baseline gap-2 font-mono text-[9.5px] tracking-[0.1em] text-muted">
                RAW <span className="text-[13px] tabular text-fg md:text-[15px]">{j.raw.toFixed(2)}</span>
              </p>
            </div>
            <div ref={(el) => { bigs.current[i] = el; }} aria-hidden className="absolute text-center" style={{ left: a.x, top: a.y, opacity: 0 }}>
              <span className="block font-semibold leading-none tracking-[-0.06em] tabular text-fg"
                style={{ fontSize: compact ? "clamp(2.6rem,14vw,4rem)" : "clamp(3.5rem,9vw,9rem)" }}>
                {j.raw.toFixed(2)}
              </span>
              <span className="mt-2 block font-mono text-[9.5px] tracking-[0.14em] text-muted">{j.id}</span>
            </div>
          </div>
        );
      })}

      {/* score packets in flight */}
      {judges.map((j, ji) => FEATURED_CRITERIA.map((c, k) => (
        <span key={`${j.id}-${c.id}`} ref={(el) => { packets.current[ji * 4 + k] = el; }} aria-hidden
          className="absolute left-0 top-0 whitespace-nowrap rounded-[2px] border border-accent/50 bg-bg px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-fg will-change-transform"
          style={{ opacity: 0 }}>
          {SHORT[k]} <span className="text-accent">{j.scores[k].toFixed(1)}</span>
        </span>
      )))}

      <div ref={cardWrap} className="absolute left-0 top-0 origin-center will-change-transform" style={{ transform: "translate(50vw, 50svh) translate(-50%, -50%)" }}>
        <Dossier fill={full} ticks={ticks} variant="panel" />
      </div>

      <motion.div className="pointer-events-none absolute bottom-[6%] left-1/2 w-[min(520px,90vw)] -translate-x-1/2 font-mono text-[10px] tracking-[0.12em] text-muted" style={{ opacity: mergeOpacity }}>
        <p className="text-center text-accent">{pad(n, 2)} JUDGES → 01 EVALUATION</p>
      </motion.div>
    </div>
  );
}

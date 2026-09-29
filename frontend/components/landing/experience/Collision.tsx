"use client";

import { useEffect, useRef } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { FEATURED, LEADERBOARD } from "./story";
import { judgeAnchor } from "./Panel";
import { Scene, Tag, easeInOut, easeOut, lerp, range, useEnv, useOnScreen, useSize } from "./runtime";

export function CollisionScene() {
  return (
    <Scene id="normalization" nav="05 / NORMALIZATION" rest={0.8} play={{ to: 0.8, duration: 4.5 }}>
      {(p) => <Collision p={p} />}
    </Scene>
  );
}

function Collision({ p }: { p: MotionValue<number> }) {
  const { compact, still } = useEnv();
  const stage = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const onScreen = useOnScreen(stage, "0px");
  const nums = useRef<(HTMLDivElement | null)[]>([]);
  const vals = useRef<(HTMLSpanElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const ring = useRef<SVGCircleElement>(null);
  const ring2 = useRef<SVGCircleElement>(null);
  const final = useRef<HTMLDivElement>(null);
  const judges = FEATURED.judges;
  const n = judges.length;

  useEffect(() => {
    if (!w) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (t: number) => {
      const v = p.get();
      const time = still ? 0 : (t - t0) / 1000;
      const c = easeInOut(range(v, 0.1, 0.6));
      const morph = range(v, 0.2, 0.5);
      const impact = range(v, 0.5, 0.64);
      const cx = w / 2, cy = h / 2;
      judges.forEach((j, i) => {
        const a = judgeAnchor(i, n, w, h, compact);
        // independent orbits that decay as the values are pulled together
        const amp = (compact ? 10 : 26) * (1 - c);
        const dx = Math.sin(time * (0.5 + i * 0.17) + i * 2) * amp + Math.sin(time * 1.3 + i) * amp * 0.3;
        const dy = Math.cos(time * (0.42 + i * 0.13) + i) * amp * 0.8;
        const x = lerp(a.x + dx, cx, c);
        const y = lerp(a.y + dy, cy, c);
        const el = nums.current[i];
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(1 - impact * 0.5).toFixed(3)})`;
          el.style.opacity = String(1 - easeOut(impact));
          el.style.filter = impact > 0 ? `blur(${(impact * 10).toFixed(1)}px)` : "";
        }
        const val = vals.current[i];
        if (val) val.textContent = lerp(j.raw, j.normalized, morph).toFixed(2);
        const ln = lines.current[i];
        if (ln) {
          ln.setAttribute("x1", String(x)); ln.setAttribute("y1", String(y));
          ln.setAttribute("x2", String(cx)); ln.setAttribute("y2", String(cy));
          ln.style.opacity = String(range(v, 0.06, 0.16) * (1 - c));
        }
      });
      const R = Math.hypot(w, h) * 0.5;
      if (ring.current) {
        ring.current.setAttribute("r", String(Math.max(0, easeOut(impact) * R)));
        ring.current.style.opacity = String(impact > 0 ? 1 - impact : 0);
      }
      if (ring2.current) {
        const k = range(v, 0.57, 0.72);
        ring2.current.setAttribute("r", String(Math.max(0, easeOut(k) * R * 0.6)));
        ring2.current.style.opacity = String(k > 0 ? (1 - k) * 0.6 : 0);
      }
      if (final.current) {
        const inn = easeOut(range(v, 0.58, 0.68));
        const out = easeInOut(range(v, 0.84, 0.98));
        final.current.style.opacity = String(inn * (1 - range(out, 0.7, 1)));
        final.current.style.transform = `translate(-50%, -50%) scale(${(lerp(1.08, 1, inn) * lerp(1, 0.02, out)).toFixed(4)})`;
      }
      raf = requestAnimationFrame(frame);
    };
    if (onScreen || still) raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [w, h, p, compact, still, onScreen, judges, n]);

  const formula = useTransform(p, [0.16, 0.24, 0.5, 0.56], [0, 1, 1, 0]);
  const head = useTransform(p, [0, 0.06, 0.5, 0.56], [0, 1, 1, 0]);
  const dot = useTransform(p, [0.94, 0.98], [0, 1]);
  const rank = LEADERBOARD.findIndex((r) => r.project.id === FEATURED.project.id) + 1;

  return (
    <div ref={stage} className="relative h-full w-full">
      <motion.div className="pointer-events-none absolute inset-x-0 top-[76px] z-10 mx-auto flex max-w-[1600px] items-start justify-between gap-6 px-5 md:top-[92px] md:px-10" style={{ opacity: head }}>
        <div className={compact ? "hidden" : ""}>
          <Tag n="05">Score collision</Tag>
          <h2 className="mt-3 max-w-[18ch] text-[clamp(1.6rem,3.2vw,3rem)] font-semibold leading-[0.92] tracking-[-0.045em]">Harsh judges. Generous judges. One fair number.</h2>
        </div>
        <p className="hidden max-w-[34ch] text-right text-[14px] leading-relaxed text-fg-2 md:block">
          Per-judge z-score normalization removes harsh-judge and generous-judge bias before ranking.
        </p>
      </motion.div>

      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
        {judges.map((j, i) => (
          <line key={j.id} ref={(el) => { lines.current[i] = el; }} stroke="rgb(var(--fg-rgb) / 0.25)" strokeDasharray="2 5" style={{ opacity: 0 }} />
        ))}
        <circle ref={ring} cx={w / 2} cy={h / 2} r="0" fill="none" stroke="var(--color-accent)" strokeWidth="1" style={{ opacity: 0 }} />
        <circle ref={ring2} cx={w / 2} cy={h / 2} r="0" fill="none" stroke="rgb(var(--fg-rgb) / 0.5)" strokeWidth="1" style={{ opacity: 0 }} />
      </svg>

      {judges.map((j, i) => (
        <div key={j.id} ref={(el) => { nums.current[i] = el; }} className="absolute left-0 top-0 text-center will-change-transform">
          <span ref={(el) => { vals.current[i] = el; }} className="block font-semibold leading-none tracking-[-0.06em] tabular text-fg"
            style={{ fontSize: compact ? "clamp(2.6rem,14vw,4rem)" : "clamp(3.5rem,9vw,9rem)" }}>
            {j.raw.toFixed(2)}
          </span>
          <span className="mt-2 block font-mono text-[9.5px] tracking-[0.14em] text-muted">{j.id}</span>
        </div>
      ))}

      <motion.div className="pointer-events-none absolute inset-x-0 bottom-[14%] text-center font-mono text-[12px] tracking-[0.06em] text-fg-2 md:text-[14px]" style={{ opacity: formula }}>
        <p>z = (x − μ<sub>judge</sub>) / σ<sub>judge</sub></p>
        <p className="mt-1.5 text-muted">x′ = μ<sub>all</sub> + z · σ<sub>all</sub></p>
      </motion.div>

      <div ref={final} className="absolute left-1/2 top-1/2 text-center" style={{ opacity: 0 }}>
        <p className="font-mono text-[10.5px] tracking-[0.2em] text-accent">NORMALIZED SCORE · {FEATURED.project.name.toUpperCase()}</p>
        <p className="mt-3 text-[clamp(6rem,22vw,20rem)] font-semibold leading-[0.8] tracking-[-0.07em] tabular text-fg">{FEATURED.normalized.toFixed(2)}</p>
        <p className="mt-5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
          RANK #{rank} OF {LEADERBOARD.length} · THE PANEL&apos;S BIAS, REMOVED
        </p>
      </div>

      <motion.div aria-hidden className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 bg-accent" style={{ opacity: dot }} />
    </div>
  );
}

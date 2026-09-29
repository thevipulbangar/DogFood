"use client";

import { useRef } from "react";
import type { MotionValue } from "motion/react";
import { weightedScore } from "@/lib/scoring";
import { cn, pad } from "@/lib/utils";
import { Ticks } from "@/components/ui/primitives";
import { FEATURED, FEATURED_CRITERIA, RUBRIC } from "./story";
import { clamp, easeOut, useEnv, useProgress } from "./runtime";

/**
 * The featured project's case file. `fill` runs 0 → 4: criterion k is being
 * evaluated while fill ∈ (k, k+1). The weighted score only counts finished
 * criteria — the same rule `weightedScore` applies in the product.
 * `ticks`, when given, overlays each judge's individual value on the bars.
 * The "panel" variant is the same record seen by the judging panel: no repeat
 * of the project's identity, just each judge's scores and how far they agree.
 */
const SPREAD = FEATURED_CRITERIA.map((_, k) => {
  const xs = FEATURED.judges.map((j) => j.scores[k]);
  return (Math.max(...xs) - Math.min(...xs)) / 2;
});

export function Dossier({ fill, ticks, variant = "full", className }: { fill: MotionValue<number>; ticks?: MotionValue<number>; variant?: "full" | "panel"; className?: string }) {
  const panel = variant === "panel";
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const vals = useRef<(HTMLSpanElement | null)[]>([]);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const judgeTicks = useRef<(HTMLSpanElement | null)[]>([]);
  const status = useRef<HTMLSpanElement>(null);
  const total = useRef<HTMLSpanElement>(null);
  const scan = useRef<HTMLDivElement>(null);
  const { scale } = useEnv();

  useProgress(fill, (f) => {
    const scored: Record<string, number> = {};
    FEATURED_CRITERIA.forEach((c, k) => {
      const t = clamp(f - k);
      const e = easeOut(t);
      if (bars.current[k]) bars.current[k]!.style.transform = `scaleX(${((c.score / 10) * e).toFixed(4)})`;
      if (vals.current[k]) vals.current[k]!.textContent = panel ? FEATURED.judges.map((j) => j.scores[k].toFixed(1)).join("  ") : t > 0 ? (c.score * e).toFixed(2) : "—";
      if (rows.current[k]) rows.current[k]!.dataset.state = t >= 1 ? "done" : t > 0 ? "live" : "idle";
      if (t >= 1) scored[c.id] = c.score;
    });
    const n = Object.keys(scored).length;
    if (total.current) total.current.textContent = panel ? `±${(SPREAD.reduce((a, b) => a + b, 0) / SPREAD.length).toFixed(2)}` : n ? weightedScore(scored, RUBRIC).toFixed(2) : "—";
    if (status.current) status.current.textContent = panel ? "CONSENSUS" : f <= 0 ? "QUEUED" : f >= 4 ? "EVALUATED" : `EVALUATING · ${pad(Math.min(4, Math.floor(f) + 1), 2)}/04`;
    if (scan.current) {
      const live = f > 0 && f < 4;
      scan.current.style.opacity = live ? "1" : "0";
      scan.current.style.transform = `translateY(${((f % 1) * 100).toFixed(1)}%)`;
    }
  });

  useProgress(ticks ?? fill, (v) => {
    if (!ticks) return;
    judgeTicks.current.forEach((el, i) => {
      if (!el) return;
      const k = Math.floor(i / FEATURED.judges.length);
      const j = i % FEATURED.judges.length;
      const arrive = clamp(v * 1.2 - j * 0.1);
      const merge = clamp((v - 0.8) / 0.2);
      const own = FEATURED.judges[j].scores[k];
      const mean = FEATURED_CRITERIA[k].score;
      const x = own + (mean - own) * merge;
      el.style.left = `${(x / 10) * 100}%`;
      el.style.opacity = String(arrive * (1 - merge * 0.85));
    });
  }, [ticks]);

  const { project, team, track } = FEATURED;
  return (
    <article
      className={cn("illuminated relative w-[min(380px,86vw)] overflow-hidden rounded-[4px] border border-line-strong bg-surface shadow-[0_30px_80px_-36px_rgb(0_0_0/0.9)]", className)}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${(e.clientX - r.left) / scale}px`);
        e.currentTarget.style.setProperty("--my", `${(e.clientY - r.top) / scale}px`);
      }}
    >
      <Ticks />
      <div ref={scan} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px bg-accent/70 opacity-0 transition-opacity duration-300" />
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[9.5px] tracking-[0.12em] text-muted">
        <span>{panel ? `PANEL OF ${FEATURED.judges.length} · ${project.name.toUpperCase()}` : `${project.code} · ${track.code}`}</span>
        <span ref={status} className="text-accent">QUEUED</span>
      </header>
      <div className="px-4 pb-4 pt-4">
        {panel ? (
          <p className="font-mono text-[9.5px] tracking-[0.12em] text-muted">
            {FEATURED.judges.map((j) => j.id.replace("JUDGE_", "J")).join("  ")} <span className="text-fg-2">· each judge, per criterion</span>
          </p>
        ) : (
          <>
            <p className="text-[32px] font-semibold leading-none tracking-[-0.04em] text-fg">{project.name}</p>
            <p className="mt-2 text-[13px] leading-snug text-fg-2">{project.tagline}</p>
            <p className="mt-3 flex flex-wrap gap-1.5 font-mono text-[9.5px] tracking-[0.08em] text-muted">
              <span className="text-fg-2">{team.name.toUpperCase()}</span>
              {project.stack.map((s) => <span key={s} className="border border-line px-1">{s}</span>)}
            </p>
          </>
        )}

        <div className={panel ? "mt-4 space-y-2.5" : "mt-5 space-y-2.5"}>
          {FEATURED_CRITERIA.map((c, k) => (
            <div key={c.id} ref={(el) => { rows.current[k] = el; }} data-state="idle"
              className="group grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 transition-opacity duration-300 data-[state=idle]:opacity-60">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-2 group-data-[state=live]:text-accent">
                {c.name}{!panel && <span className="text-muted"> · {c.weight}%</span>}
              </span>
              <span ref={(el) => { vals.current[k] = el; }} className="text-right font-mono text-[11px] tabular text-fg">—</span>
              <span className="relative col-span-2 h-[3px] bg-fg/[0.07]">
                <span ref={(el) => { bars.current[k] = el; }} className="absolute inset-0 origin-left bg-fg group-data-[state=live]:bg-accent" style={{ transform: "scaleX(0)" }} />
                {ticks && FEATURED.judges.map((j, ji) => (
                  <span key={j.id} ref={(el) => { judgeTicks.current[k * FEATURED.judges.length + ji] = el; }}
                    className="absolute -top-[3px] h-[9px] w-px -translate-x-1/2 bg-accent" style={{ opacity: 0 }} />
                ))}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-end justify-between border-t border-line pt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {panel ? <>Panel agreement<br /><span className="text-fg-2">mean half-range · lower is tighter</span></> : <>Weighted score<br /><span className="text-fg-2">{RUBRIC.length} criteria · 0–10</span></>}
          </span>
          <span ref={total} className="text-[40px] font-semibold leading-none tracking-[-0.05em] tabular text-fg">—</span>
        </div>
      </div>
    </article>
  );
}

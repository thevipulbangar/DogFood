"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { pad } from "@/lib/utils";
import { CRITERION_AVG, FEATURED, JUDGE_SPREAD, SCORE_POINTS, SUBMITTED, TOP } from "./story";
import { Scene, Scramble, Tag, type Playhead, clamp, easeInOut, easeOut, lerp, range, useEnv, useProgress, useSize } from "./runtime";

const DEPTHS = [
  { k: "Individual scores", d: "Every submitted score — one point per judge × project." },
  { k: "Criterion averages", d: "Each rubric criterion, averaged across all judges." },
  { k: "Judge agreement", d: "Each judge's range and mean. Harsh and generous judges become visible." },
  { k: "Team comparison", d: "Raw mean against normalized score for the leading projects." },
  { k: "Overall results", d: "The ranking, on normalized scores." },
];
const INTRO = 0.07;
const OUTRO = 0.955;

/** Scene progress → (current depth, blend toward the next). Each depth holds, then morphs. */
function depthAt(v: number) {
  const t = clamp((v - INTRO) / (OUTRO - INTRO)) * DEPTHS.length;
  const k = Math.min(DEPTHS.length - 1, Math.floor(t));
  const e = k === DEPTHS.length - 1 ? 0 : easeInOut(range(t - k, 0.55, 1));
  return { k, e };
}

export function AnalyticsScene() {
  return (
    <Scene id="results" nav="06 / RESULTS" rest={hold(2)}>
      {(p, ph) => <Analytics p={p} ph={ph} />}
    </Scene>
  );
}

type Pt = { x: number; y: number; o: number; r: number };

/** Timeline position where depth `k` is fully formed (each depth holds, then morphs). */
function hold(k: number) {
  return INTRO + ((k + 0.25) / DEPTHS.length) * (OUTRO - INTRO);
}
const DWELL = 3800;

function Analytics({ p, ph }: { p: MotionValue<number>; ph: Playhead }) {
  const { compact, scale: stageScale } = useEnv();
  const stage = useRef<HTMLDivElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  const { w: cw, h: ch } = useSize(chart);
  const stageSize = useSize(stage);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const layers = useRef<(SVGGElement | null)[]>([]);
  const grow = useRef<(SVGElement | null)[]>([]);
  const counters = useRef<{ el: HTMLElement | SVGTextElement | null; v: number; d: number; layer: number }[]>([]);
  const live = useRef<Pt[]>([]);
  const tip = useRef<HTMLDivElement>(null);
  const [depth, setDepth] = useState(0);
  const [hover, setHover] = useState(-1);

  // Depths advance on their own while the scene is on screen; any click takes over.
  const target = useRef(-1);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!ph.active || !auto) return;
    if (target.current < 0) { target.current = 0; ph.go(hold(0), 1.6); }
    const id = window.setInterval(() => {
      if (target.current >= DEPTHS.length - 1) { window.clearInterval(id); return; }
      target.current += 1;
      ph.go(hold(target.current), 1.7);
    }, DWELL);
    return () => window.clearInterval(id);
  }, [ph, auto]);
  const select = (k: number) => {
    setAuto(false);
    const from = Math.max(0, target.current);
    target.current = k;
    ph.go(hold(k), 1.1 + 0.35 * Math.abs(k - from));
  };

  const nProj = SUBMITTED.length;
  const featured = FEATURED.project.id;
  const topIndex = useMemo(() => new Map(TOP.map((t, i) => [t.id, i])), []);
  const within = useMemo(() => SCORE_POINTS.map((pt, i) => SCORE_POINTS.slice(0, i).filter((q) => q.projectId === pt.projectId).length), []);
  const globalMean = SCORE_POINTS.reduce((s, x) => s + x.raw, 0) / SCORE_POINTS.length;

  // ── geometry ─────────────────────────────────────────────
  const G = useMemo(() => {
    const m = { l: compact ? 30 : 44, r: 10, t: 14, b: 34 };
    const pw = Math.max(1, cw - m.l - m.r), ph = Math.max(1, ch - m.t - m.b);
    const yRaw = (s: number) => m.t + ph - (clamp(s, 4, 10) - 4) / 6 * ph;
    const y10 = (s: number) => m.t + ph - (s / 10) * ph;
    const band = (i: number, n: number) => m.l + ((i + 0.5) / n) * pw;
    const R = { l: compact ? 98 : 190, r: compact ? 44 : 70, t: 10, b: 18 };
    const rw = Math.max(1, cw - R.l - R.r);
    const rowH = (ch - R.t - R.b) / TOP.length;
    const rowY = (r: number) => R.t + (r + 0.5) * rowH;
    const xScore = (s: number) => R.l + ((clamp(s, 5, 10) - 5) / 5) * rw;
    const xBar = (s: number) => R.l + (s / 10) * rw;
    const bw = Math.min(pw / 4 * 0.52, 110);
    return { m, pw, ph, yRaw, y10, band, R, rw, rowH, rowY, xScore, xBar, bw };
  }, [cw, ch, compact]);

  const positions = useMemo(() => {
    if (!cw) return null;
    const { yRaw, band, rowY, xScore, xBar, bw, y10, m } = G;
    const cols = Math.max(1, Math.floor((bw - 4) / 8));
    return SCORE_POINTS.map((pt, i): Pt[] => {
      const f = pt.projectId === featured;
      const base = f ? 4.5 : 3;
      const top = topIndex.get(pt.projectId);
      const k = i % 4, mIdx = Math.floor(i / 4);
      const barL = band(k, 4) - bw / 2;
      const jitter = ((pt.projectIndex * 37) % 11 - 5) / 5;
      return [
        { x: band(pt.projectIndex, nProj) + (within[i] - 1) * 3, y: yRaw(pt.raw), o: 1, r: base },
        { x: barL + 5 + (mIdx % cols) * 8, y: Math.max(y10(CRITERION_AVG[k].value) + 5, m.t + G.ph - 5 - Math.floor(mIdx / cols) * 8), o: 0.9, r: 2.2 },
        { x: band(pt.judgeIndex, 8) + jitter * (G.pw / 8) * 0.14, y: yRaw(pt.raw), o: 1, r: base },
        top != null ? { x: xScore(pt.raw), y: rowY(top) + (within[i] - 1) * 5, o: 0.9, r: 2.6 } : { x: xScore(pt.raw), y: G.rowY(TOP.length - 1) + 60, o: 0, r: 2 },
        top != null ? { x: xBar(TOP[top].normalized), y: rowY(top), o: 1, r: 3 } : { x: G.R.l, y: rowY(TOP.length - 1) + 60, o: 0, r: 1 },
      ];
    });
  }, [G, cw, featured, nProj, topIndex, within]);

  // offset from the chart box to the stage center (where the collision left its dot)
  const origin = useMemo(() => {
    if (!chart.current || !stage.current) return { x: cw / 2, y: ch / 2 };
    const a = chart.current.getBoundingClientRect(), b = stage.current.getBoundingClientRect();
    return { x: b.left + b.width / 2 - a.left, y: b.top + b.height / 2 - a.top };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cw, ch, stageSize.w, stageSize.h]);

  useProgress(p, (v) => {
    if (!positions) return;
    const { k, e } = depthAt(v);
    const dominant = e > 0.5 ? k + 1 : k;
    setDepth((d) => (d === dominant ? d : dominant));
    const intro = easeOut(range(v, 0, INTRO));
    const outro = easeInOut(range(v, OUTRO, 1));
    const weight = (j: number) => (j === k ? 1 - e : j === k + 1 ? e : 0);

    positions.forEach((ps, i) => {
      const a = ps[k], b = ps[Math.min(DEPTHS.length - 1, k + 1)];
      let x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e);
      const o = lerp(a.o, b.o, e);
      const r = lerp(a.r, b.r, e);
      x = lerp(origin.x, x, intro);
      y = lerp(origin.y, y, intro);
      // outro: the data is flung outward, to be gathered again by the next scene
      const ang = (i * 2.399) % (Math.PI * 2);
      x += Math.cos(ang) * outro * cw * 0.9;
      y += Math.sin(ang) * outro * ch * 0.9;
      live.current[i] = { x, y, o: o * (1 - outro), r };
      const el = dots.current[i];
      if (!el) return;
      el.setAttribute("cx", x.toFixed(1));
      el.setAttribute("cy", y.toFixed(1));
      el.setAttribute("r", r.toFixed(2));
      el.style.opacity = String(o * (0.35 + intro * 0.65) * (1 - outro));
    });
    layers.current.forEach((g, j) => { if (g) g.style.opacity = String(weight(j) * (1 - outro)); });
    grow.current.forEach((g) => {
      if (!g) return;
      const j = Number(g.dataset.layer);
      const t = easeOut(clamp(weight(j) * 1.25 - Number(g.dataset.delay ?? 0)));
      g.style.transform = g.dataset.axis === "x" ? `scaleX(${t})` : `scaleY(${t})`;
    });
    counters.current.forEach((c) => {
      if (!c?.el) return;
      c.el.textContent = (c.v * easeOut(clamp(weight(c.layer) * 1.25))).toFixed(c.d);
    });
  }, [positions, origin, cw, ch]);

  const onMove = (e: React.PointerEvent) => {
    const r = chart.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / stageScale, y = (e.clientY - r.top) / stageScale;
    let best = -1, bd = 14 * 14;
    live.current.forEach((d, i) => {
      if (!d || d.o < 0.3) return;
      const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    });
    setHover(best);
    if (tip.current && best >= 0) {
      const d = live.current[best];
      tip.current.style.transform = `translate3d(${Math.min(d.x + 14, cw - 220)}px, ${d.y + 14}px, 0)`;
    }
  };

  const hp = hover >= 0 ? SCORE_POINTS[hover] : null;
  const counter = (layer: number, v: number, d = 2) => (el: HTMLElement | SVGTextElement | null) => {
    if (el && !counters.current.some((c) => c.el === el)) counters.current.push({ el, v, d, layer });
  };
  const growRef = (el: SVGElement | null) => { if (el && !grow.current.includes(el)) grow.current.push(el); };
  const headOpacity = useTransform(p, [0, INTRO, OUTRO, 1], [0, 1, 1, 0]);
  const { m, R } = G;

  return (
    <div ref={stage} className="relative flex h-full w-full flex-col px-5 pb-16 pt-[76px] md:px-10 md:pb-16 md:pt-[92px]">
      <motion.div className="mx-auto flex w-full max-w-[1600px] items-end justify-between gap-6" style={{ opacity: headOpacity }}>
        <div>
          <Tag n="06">Evaluation data</Tag>
          <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,3.4rem)] font-semibold leading-[0.92] tracking-[-0.045em]">Descend into the data.</h2>
        </div>
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted">
          DEPTH <span className="text-fg">{pad(depth + 1, 2)}</span> / {pad(DEPTHS.length, 2)}
        </p>
      </motion.div>

      <div className="mx-auto mt-6 grid min-h-0 w-full max-w-[1600px] flex-1 gap-6 md:mt-10 md:grid-cols-[260px_1fr] md:gap-10">
        {/* depth rail */}
        <motion.ol className="relative hidden border-l border-line md:block" style={{ opacity: headOpacity }}>
          <span aria-hidden className="absolute -left-px top-0 w-px bg-accent transition-[height] duration-700" style={{ height: `${((depth + 1) / DEPTHS.length) * 100}%` }} />
          {DEPTHS.map((d, i) => (
            <li key={d.k}>
              <button type="button" onClick={() => select(i)} aria-pressed={i === depth}
                className="relative block w-full pb-6 pl-5 text-left transition-opacity duration-500 hover:opacity-100 focus-visible:opacity-100" style={{ opacity: i === depth ? 1 : 0.55 }}>
                <p className="font-mono text-[10px] tracking-[0.14em] text-muted">{pad(i + 1, 2)}</p>
                <p className="mt-1 text-[16px] font-medium tracking-tight text-fg">{d.k}</p>
                <p className="mt-1 max-h-0 overflow-hidden text-[12.5px] leading-snug text-fg-2 transition-[max-height] duration-500" style={{ maxHeight: i === depth ? 80 : 0 }}>{d.d}</p>
              </button>
            </li>
          ))}
        </motion.ol>
        <div className="md:hidden">
          <p className="font-mono text-[10.5px] tracking-[0.12em] text-accent"><Scramble text={DEPTHS[depth].k.toUpperCase()} /></p>
          <div className="mt-2 flex gap-1.5">
            {DEPTHS.map((d, i) => (
              <button key={d.k} type="button" onClick={() => select(i)} aria-label={d.k} aria-pressed={i === depth}
                className="h-7 flex-1 rounded-[3px] border font-mono text-[10px] transition-colors"
                style={{ borderColor: i === depth ? "var(--color-accent)" : "var(--color-line-strong)", color: i === depth ? "var(--color-fg)" : "var(--color-muted)" }}>
                {pad(i + 1, 2)}
              </button>
            ))}
          </div>
        </div>

        <div ref={chart} className="relative min-h-0" onPointerMove={onMove} onPointerLeave={() => setHover(-1)}>
          {cw > 0 && positions && (
            <svg width={cw} height={ch} className="absolute inset-0 overflow-visible" role="img" aria-label="Evaluation data: individual scores, criterion averages, judge agreement, team comparison and overall results">
              {/* 0 — individual scores */}
              <g ref={(el) => { layers.current[0] = el; }}>
                {[4, 6, 8, 10].map((s) => (
                  <g key={s}>
                    <line x1={m.l} x2={cw - m.r} y1={G.yRaw(s)} y2={G.yRaw(s)} stroke="rgb(var(--fg-rgb) / 0.07)" />
                    <text x={m.l - 8} y={G.yRaw(s) + 3} textAnchor="end" className="fill-muted font-mono text-[9px]">{s}</text>
                  </g>
                ))}
                <text x={m.l} y={ch - 8} className="fill-muted font-mono text-[9px] tracking-[0.1em]">{SUBMITTED.length} SUBMITTED PROJECTS →</text>
                <text x={cw - m.r} y={ch - 8} textAnchor="end" className="fill-muted font-mono text-[9px] tracking-[0.1em]">{SCORE_POINTS.length} SCORES · RAW WEIGHTED</text>
              </g>

              {/* 1 — criterion averages */}
              <g ref={(el) => { layers.current[1] = el; }} style={{ opacity: 0 }}>
                <line x1={m.l} x2={cw - m.r} y1={G.y10(0)} y2={G.y10(0)} stroke="rgb(var(--fg-rgb) / 0.2)" />
                {CRITERION_AVG.map((c, k) => {
                  const x = G.band(k, 4) - G.bw / 2;
                  const y = G.y10(c.value);
                  return (
                    <g key={c.id}>
                      {/* a pale column with a crisp cap — ink, orange for the strongest criterion */}
                      <g ref={growRef} data-layer="1" data-delay={k * 0.08}
                        style={{ transformBox: "fill-box", transformOrigin: "50% 100%", transform: "scaleY(0)" }}>
                        <rect x={x} y={y} width={G.bw} height={G.y10(0) - y} fill="rgb(var(--fg-rgb) / 0.06)" />
                        <rect x={x} y={y} width={G.bw} height={2} fill={k === 1 ? "var(--color-accent)" : "var(--color-fg)"} />
                      </g>
                      <text ref={counter(1, c.value)} x={x + G.bw / 2} y={y - 10} textAnchor="middle" className="fill-fg font-mono text-[13px]">0.00</text>
                      <text x={x + G.bw / 2} y={ch - 16} textAnchor="middle" className="fill-fg-2 font-mono text-[9.5px] tracking-[0.08em]">{compact ? c.label.split(" ").map((s) => s[0]).join("") : c.label.toUpperCase()}</text>
                      <text x={x + G.bw / 2} y={ch - 4} textAnchor="middle" className="fill-muted font-mono text-[9px]">{c.weight}%</text>
                    </g>
                  );
                })}
              </g>

              {/* 2 — judge agreement */}
              <g ref={(el) => { layers.current[2] = el; }} style={{ opacity: 0 }}>
                <line x1={m.l} x2={cw - m.r} y1={G.yRaw(globalMean)} y2={G.yRaw(globalMean)} stroke="var(--color-accent)" strokeDasharray="3 4" strokeOpacity="0.6" />
                <text x={cw - m.r} y={G.yRaw(globalMean) - 6} textAnchor="end" className="fill-accent font-mono text-[9px] tracking-[0.1em]">PANEL MEAN {globalMean.toFixed(2)}</text>
                {JUDGE_SPREAD.map((j, i) => {
                  const x = G.band(i, 8);
                  return (
                    <g key={j.id}>
                      <line ref={growRef} data-layer="2" data-delay={i * 0.04} x1={x} x2={x} y1={G.yRaw(j.max)} y2={G.yRaw(j.min)} stroke="rgb(var(--fg-rgb) / 0.45)"
                        style={{ transformBox: "fill-box", transformOrigin: "50% 50%", transform: "scaleY(0)" }} />
                      <line x1={x - 10} x2={x + 10} y1={G.yRaw(j.mean)} y2={G.yRaw(j.mean)} stroke={j.mean < globalMean ? "var(--color-fg)" : "var(--color-accent)"} strokeWidth="2" />
                      <text x={x} y={ch - 16} textAnchor="middle" className="fill-fg-2 font-mono text-[9.5px]">{j.id.replace("JUDGE_", "J")}</text>
                      <text x={x} y={ch - 4} textAnchor="middle" className="fill-muted font-mono text-[9px]">{(j.mean - globalMean >= 0 ? "+" : "") + (j.mean - globalMean).toFixed(1)}</text>
                    </g>
                  );
                })}
              </g>

              {/* 3 — team comparison */}
              <g ref={(el) => { layers.current[3] = el; }} style={{ opacity: 0 }}>
                {[5, 7.5, 10].map((s) => <text key={s} x={G.xScore(s)} y={ch - 2} textAnchor="middle" className="fill-muted font-mono text-[9px]">{s}</text>)}
                {TOP.map((t, r) => (
                  <g key={t.id} className="[&:hover_rect]:fill-fg/[0.03]">
                    <rect x={0} y={G.rowY(r) - G.rowH / 2} width={cw} height={G.rowH} fill="transparent" />
                    <text x={R.l - 14} y={G.rowY(r) + 4} textAnchor="end" className={`font-mono text-[10.5px] ${t.id === featured ? "fill-accent" : "fill-fg-2"}`}>{compact ? t.name : `P-${pad(t.id)} ${t.name}`}</text>
                    <line ref={growRef} data-layer="3" data-axis="x" data-delay={r * 0.05} x1={G.xScore(t.raw)} x2={G.xScore(t.normalized)} y1={G.rowY(r)} y2={G.rowY(r)} stroke="rgb(var(--fg-rgb) / 0.5)"
                      style={{ transformBox: "fill-box", transformOrigin: "0% 50%", transform: "scaleX(0)" }} />
                    <rect x={G.xScore(t.raw) - 3} y={G.rowY(r) - 3} width="6" height="6" fill="none" stroke="var(--color-fg-2)" />
                    <rect x={G.xScore(t.normalized) - 3.5} y={G.rowY(r) - 3.5} width="7" height="7" fill="var(--color-accent)" />
                  </g>
                ))}
                <text x={cw - R.r} y={10} textAnchor="end" className="fill-muted font-mono text-[9px] tracking-[0.1em]">□ RAW · ■ NORMALIZED</text>
              </g>

              {/* 4 — overall results */}
              <g ref={(el) => { layers.current[4] = el; }} style={{ opacity: 0 }}>
                {TOP.map((t, r) => (
                  <g key={t.id} className="[&:hover_.bar]:opacity-80">
                    <text x={R.l - 14} y={G.rowY(r) + 4} textAnchor="end" className={`font-mono text-[10.5px] ${t.id === featured ? "fill-accent" : "fill-fg"}`}>
                      {pad(r + 1, 2)} {compact ? "" : `· ${t.name}`}
                    </text>
                    {compact && <text x={R.l - 36} y={G.rowY(r) + 4} textAnchor="end" className="fill-fg-2 font-mono text-[10px]">{t.name}</text>}
                    <rect ref={growRef} data-layer="4" data-axis="x" data-delay={r * 0.06} className="bar transition-[fill]" x={R.l} y={G.rowY(r) - Math.min(5, G.rowH * 0.18)} width={G.xBar(t.normalized) - R.l} height={Math.min(10, G.rowH * 0.36)}
                      fill={t.id === featured ? "var(--color-accent)" : r === 0 ? "var(--color-fg)" : "rgb(var(--fg-rgb) / 0.78)"}
                      style={{ transformBox: "fill-box", transformOrigin: "0% 50%", transform: "scaleX(0)" }} />
                    <text ref={counter(4, t.normalized)} x={G.xBar(t.normalized) + 10} y={G.rowY(r) + 4} className="fill-fg font-mono text-[11px]">0.00</text>
                  </g>
                ))}
              </g>

              {SCORE_POINTS.map((pt, i) => (
                <circle key={i} ref={(el) => { dots.current[i] = el; }} r="3"
                  fill={pt.projectId === featured ? "var(--color-accent)" : i === hover ? "var(--color-fg)" : "var(--color-fg-2)"}
                  stroke={i === hover ? "var(--color-fg)" : "none"} strokeOpacity="0.25" strokeWidth={i === hover ? 8 : 0}
                  style={{ opacity: 0 }} />
              ))}
            </svg>
          )}
          <div ref={tip} className="pointer-events-none absolute left-0 top-0 z-10 w-[210px] rounded-[3px] border border-line-strong bg-surface p-2.5 font-mono text-[10px] text-muted shadow-2xl transition-opacity duration-150" style={{ opacity: hp ? 1 : 0 }}>
            {hp && (
              <>
                <p className="tracking-[0.1em] text-accent">{hp.label}</p>
                <p className="mt-1 text-[12px] text-fg">{SUBMITTED[hp.projectIndex]?.name}</p>
                <p className="mt-1.5 flex justify-between"><span>RAW</span><span className="text-fg">{hp.raw.toFixed(2)}</span></p>
                <p className="flex justify-between"><span>NORMALIZED</span><span className="text-fg">{hp.normalized.toFixed(2)}</span></p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

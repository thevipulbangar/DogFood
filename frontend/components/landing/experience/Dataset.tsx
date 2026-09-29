"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { mulberry32, pad } from "@/lib/utils";
import { FEATURED, PROJECTS, SUBMITTED, TRACKS } from "./story";
import { Scene, ScrubText, Tag, easeInOut, easeOut, lerp, range, useEnv, useOnScreen, useProgress, useSize } from "./runtime";

// Timeline (0..1, played on arrival)
const T = {
  count: [0.02, 0.2] as const,
  sentence: [0.2, 0.32] as const,
  burst: [0.4, 0.52] as const,
  core: [0.52, 0.72] as const,
  focus: [0.74, 0.88] as const,
};
const END = 0.9;
const STEPS: [number, number][] = [[0, 100], [0.3, 247], [0.6, 512], [1, 1024]];

/** One colour per track — the core reads as four interleaved populations. */
const TRACK_RGB = ["237,236,232", "255,90,31", "245,184,61", "122,167,255"];
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function DatasetScene() {
  return (
    <Scene id="submissions" nav="02 / SUBMISSIONS" rest={END} play={{ to: END, duration: 7.5 }}>
      {(p) => <Dataset p={p} />}
    </Scene>
  );
}

type Node = {
  hx: number; hy: number; fx: number; fy: number;
  /** direction on the unit sphere × spoke length */
  dx: number; dy: number; dz: number;
  track: number; real: number; size: number;
};

function Dataset({ p }: { p: MotionValue<number> }) {
  const { still, compact, pointer, px, py, scale: stageScale } = useEnv();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const numberEl = useRef<HTMLDivElement>(null);
  const valueEl = useRef<HTMLSpanElement>(null);
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const tip = useRef<HTMLDivElement>(null);
  const focusTag = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const onScreen = useOnScreen(stage, "100px");
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [lit, setLit] = useState(-1);
  const litRef = useRef(-1);
  litRef.current = lit;

  const trackCounts = useMemo(() => TRACKS.map((t) => SUBMITTED.filter((s) => s.trackId === t.id).length), []);
  const featuredIdx = PROJECTS.findIndex((x) => x.id === FEATURED.project.id);
  /** Real projects that carry a live status tag, Antimetal-style. */
  const tagged = useMemo(() => [2, 7, 13, 21, 26].filter((i) => i !== featuredIdx && i < PROJECTS.length).slice(0, compact ? 3 : 5), [featuredIdx, compact]);

  const core = () => compact
    ? { cx: w / 2, cy: h * 0.6, R: Math.min(w * 0.36, h * 0.23) }
    : { cx: w * 0.62, cy: h * 0.56, R: Math.min(h * 0.29, w * 0.2) };

  // Build the node field from the glyphs of the final number, then give every
  // node a seat on a sphere: an even Fibonacci spread, spokes of varied length.
  useEffect(() => {
    if (!w || !h || !valueEl.current) return;
    let cancelled = false;
    (async () => {
      try { await document.fonts?.ready; } catch {}
      if (cancelled || !valueEl.current) return;
      const el = valueEl.current;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const srect = stage.current!.getBoundingClientRect();
      const off = document.createElement("canvas");
      off.width = Math.ceil(w);
      off.height = Math.ceil(h);
      const ctx = off.getContext("2d")!;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing; } catch {}
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      // client rects are scaled with the stage; convert back to stage coordinates
      ctx.fillText("1,024", (rect.left - srect.left + rect.width / 2) / stageScale, (rect.top - srect.top + rect.height / 2) / stageScale);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      const step = compact ? 7 : 6;
      const pts: [number, number][] = [];
      for (let y = 0; y < off.height; y += step)
        for (let x = 0; x < off.width; x += step)
          if (data[(y * off.width + x) * 4 + 3] > 140) pts.push([x, y]);

      const r = mulberry32(1024);
      const max = compact ? 150 : 300;
      while (pts.length > max) pts.splice(Math.floor(r() * pts.length), 1);
      const N = pts.length;
      const weights = trackCounts.map((c) => c + 1);
      const wsum = weights.reduce((a, b) => a + b, 0);
      const pickTrack = () => { let x = r() * wsum; for (let i = 0; i < 4; i++) { x -= weights[i]; if (x <= 0) return i; } return 3; };
      // real projects get evenly spaced seats so they spread around the sphere
      const realAt = new Map(PROJECTS.map((_, k) => [Math.floor(((k + 0.5) / PROJECTS.length) * N), k]));

      const out: Node[] = pts.map(([hx, hy], i) => {
        const real = realAt.get(i) ?? -1;
        const track = real >= 0 ? TRACKS.findIndex((t) => t.id === PROJECTS[real].trackId) : pickTrack();
        const y = 1 - (2 * (i + 0.5)) / N;
        const rr = Math.sqrt(1 - y * y);
        const th = i * GOLDEN;
        const len = real >= 0 ? 0.92 + r() * 0.08 : 0.45 + Math.pow(r(), 0.7) * 0.55;
        return {
          hx, hy,
          fx: 40 + r() * (w - 80), fy: 90 + r() * (h - 180),
          dx: Math.cos(th) * rr * len, dy: y * len, dz: Math.sin(th) * rr * len,
          track, real,
          size: real >= 0 ? 3.2 + r() * 1.6 : 1.1 + r() * 1.1,
        };
      });
      if (!cancelled) setNodes(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, compact, trackCounts, stageScale]);

  // Number: 100 → 247 → 512 → 1,024, then freeze.
  useProgress(p, (v) => {
    const k = range(v, ...T.count);
    let val = 100;
    for (let i = 1; i < STEPS.length; i++) {
      const [a, va] = STEPS[i - 1];
      const [b, vb] = STEPS[i];
      if (k >= a && k <= b) { val = Math.round(lerp(va, vb, easeOut((k - a) / (b - a)))); break; }
      if (k > b) val = vb;
    }
    if (valueEl.current) valueEl.current.textContent = val.toLocaleString("en-US");
    if (numberEl.current) {
      const out = range(v, T.burst[0], T.burst[0] + 0.03);
      numberEl.current.style.opacity = String(1 - out);
      numberEl.current.style.transform = `scale(${1 + range(v, ...T.count) * 0.04})`;
    }
  });

  // The core: projection, HUD, tags, hover.
  useEffect(() => {
    if (!nodes || !canvas.current) return;
    const c = canvas.current;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fIndex = nodes.findIndex((n) => n.real === featuredIdx);
    const { cx, cy, R } = core();
    const F = 3.4; // perspective, in radii
    let raf = 0;
    const t0 = performance.now();
    const sx = new Float32Array(nodes.length), sy = new Float32Array(nodes.length), sz = new Float32Array(nodes.length), sk = new Float32Array(nodes.length);
    const order = nodes.map((_, i) => i);

    const draw = (time: number) => {
      const v = p.get();
      const tt = still ? 0 : (time - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const appear = range(v, T.burst[0], T.burst[0] + 0.02);
      if (appear <= 0) return;
      const burst = easeOut(range(v, ...T.burst));
      const cl = easeInOut(range(v, ...T.core));
      const focus = easeOut(range(v, ...T.focus));
      const yaw = 0.6 + tt * 0.11 + px.get() * 0.45;
      const pitch = -0.32 + py.get() * 0.22;
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const focusTrack = litRef.current;

      // positions: glyph → loose field → seat on the rotating sphere
      nodes.forEach((n, i) => {
        const x1 = n.dx * cyw + n.dz * syw;
        const z1 = -n.dx * syw + n.dz * cyw;
        const y2 = n.dy * cp - z1 * sp;
        const z2 = n.dy * sp + z1 * cp;
        const k = F / (F + z2);
        const tx = cx + x1 * R * k, ty = cy - y2 * R * k;
        const bx = lerp(n.hx, n.fx, burst), by = lerp(n.hy, n.fy, burst);
        sx[i] = lerp(bx, tx, cl); sy[i] = lerp(by, ty, cl); sz[i] = z2; sk[i] = k;
      });
      order.sort((a, b) => sz[b] - sz[a]); // far first

      // ── HUD: instrument rings (JARVIS-style), drawn in as the core forms ──
      const hud = range(cl, 0.3, 1);
      if (hud > 0) {
        const r1 = R * 1.16, r2 = R * 1.3, r0 = R * 0.16;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.12 * hud})`;
        ctx.beginPath(); ctx.arc(cx, cy, r1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hud); ctx.stroke();
        // ticks: every 5°, long every 30°
        const rot = tt * 0.04;
        ctx.beginPath();
        for (let d = 0; d < 360 * hud; d += 5) {
          const a = (d * Math.PI) / 180 + rot;
          const long = d % 30 === 0;
          const i0 = r1 + 3, i1 = r1 + (long ? 12 : 6);
          ctx.moveTo(cx + Math.cos(a) * i0, cy + Math.sin(a) * i0);
          ctx.lineTo(cx + Math.cos(a) * i1, cy + Math.sin(a) * i1);
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.2 * hud})`;
        ctx.stroke();
        // outer broken ring, counter-rotating
        ctx.strokeStyle = `rgba(255,255,255,${0.08 * hud})`;
        for (let s = 0; s < 6; s++) {
          const a0 = -tt * 0.06 + (s * Math.PI) / 3;
          ctx.beginPath(); ctx.arc(cx, cy, r2, a0, a0 + Math.PI / 4); ctx.stroke();
        }
        // sweep: the one orange instrument
        const sw = tt * 0.5;
        ctx.strokeStyle = `rgba(255,90,31,${0.75 * hud})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r1, sw, sw + 0.55); ctx.stroke();
        ctx.lineWidth = 1;
        // bearings
        ctx.fillStyle = `rgba(255,255,255,${0.35 * hud})`;
        ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ["000", "090", "180", "270"].forEach((lbl, q) => {
          const a = -Math.PI / 2 + (q * Math.PI) / 2 + rot;
          ctx.fillText(lbl, cx + Math.cos(a) * (r1 + 24), cy + Math.sin(a) * (r1 + 24));
        });
        // inner reticle
        ctx.strokeStyle = `rgba(255,255,255,${0.1 * hud})`;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── spokes: hub → node, fainter at the back ──
      if (cl > 0.02) {
        ctx.lineWidth = 0.7;
        for (const i of order) {
          const n = nodes[i];
          const depth = (1 - sz[i]) / 2; // 0 back … 1 front
          const dim = focusTrack >= 0 && n.track !== focusTrack ? 0.2 : 1;
          const a = cl * (n.real >= 0 ? 0.32 : 0.05 + depth * 0.1) * dim;
          ctx.strokeStyle = n.real >= 0 ? `rgba(${TRACK_RGB[n.track]},${a})` : `rgba(255,255,255,${a})`;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx[i], sy[i]); ctx.stroke();
        }
      }

      // ── nodes ──
      for (const i of order) {
        const n = nodes[i];
        const depth = (1 - sz[i]) / 2;
        const dim = focusTrack >= 0 && n.track !== focusTrack ? 0.18 : 1;
        const isF = i === fIndex;
        const rad = n.size * (cl > 0 ? lerp(1, sk[i], cl) : 1);
        const a = appear * (n.real >= 0 ? 0.55 + depth * 0.45 : 0.2 + depth * 0.45) * dim;
        const rgb = isF ? "255,90,31" : TRACK_RGB[n.track];
        if (n.real >= 0 && cl > 0.5) {
          ctx.fillStyle = `rgba(${rgb},${0.12 * a})`; // halo
          ctx.beginPath(); ctx.arc(sx[i], sy[i], rad * 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.beginPath(); ctx.arc(sx[i], sy[i], rad, 0, Math.PI * 2); ctx.fill();
      }

      // ── hub ──
      if (cl > 0) {
        ctx.fillStyle = `rgba(255,90,31,${0.18 * cl})`;
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.95 * cl})`;
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      }

      // ── featured lock-on ──
      if (focus > 0 && fIndex >= 0) {
        const x = sx[fIndex], y = sy[fIndex];
        const r = 11 + (1 - focus) * 40;
        ctx.strokeStyle = `rgba(255,90,31,${0.9 * focus})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          ctx.moveTo(x + ax * r, y + ay * (r - 5)); ctx.lineTo(x + ax * r, y + ay * r); ctx.lineTo(x + ax * (r - 5), y + ay * r);
        }
        ctx.stroke();
        if (focusTag.current) {
          const fw = focusTag.current.offsetWidth;
          const left = x + r + 8 + fw > w - 8; // flip to the node's left rather than run off-screen
          focusTag.current.style.transform = `translate3d(${left ? x - r - 8 - fw : x + r + 8}px, ${y - 9}px, 0)`;
          focusTag.current.style.opacity = String(focus);
        }
      }

      // ── live status tags ride their nodes; hidden when they swing behind ──
      tagged.forEach((ri, k) => {
        const el = tags.current[k];
        const i = nodes.findIndex((m) => m.real === ri);
        if (!el || i < 0) return;
        const front = range(-sz[i], -0.15, 0.35);
        const tw = el.offsetWidth;
        el.style.transform = `translate3d(${sx[i] + 9 + tw > w - 8 ? sx[i] - 9 - tw : sx[i] + 9}px, ${sy[i] - 9}px, 0)`;
        el.style.opacity = String(range(cl, 0.7, 1) * front * (focusTrack >= 0 && nodes[i].track !== focusTrack ? 0.2 : 1));
      });

      // ── hover: inspect any real project ──
      const ptr = pointer.current!;
      if (tip.current) {
        let hit = -1;
        if (cl > 0.9 && ptr.active) {
          const srect = stage.current!.getBoundingClientRect();
          const mx = (ptr.x - srect.left) / stageScale, my = (ptr.y - srect.top) / stageScale;
          let bd = 16 * 16;
          nodes.forEach((n, i) => {
            if (n.real < 0 || sz[i] > 0.3) return;
            const d = (sx[i] - mx) ** 2 + (sy[i] - my) ** 2;
            if (d < bd) { bd = d; hit = i; }
          });
          if (hit >= 0) {
            const pr = PROJECTS[nodes[hit].real];
            tip.current.style.transform = `translate3d(${sx[hit] + 14}px, ${sy[hit] + 14}px, 0)`;
            tip.current.querySelector("[data-n]")!.textContent = pr.name;
            tip.current.querySelector("[data-m]")!.textContent = `${pr.code} · ${TRACKS.find((t) => t.id === pr.trackId)!.code} · ${pr.status.toUpperCase()}`;
            tip.current.querySelector("[data-t]")!.textContent = pr.tagline;
          }
        }
        tip.current.style.opacity = hit >= 0 ? "1" : "0";
      }
    };

    const loop = (t: number) => { draw(t); raf = requestAnimationFrame(loop); };
    if (onScreen && !still) raf = requestAnimationFrame(loop);
    else draw(performance.now());
    const unsub = still ? p.on("change", () => draw(performance.now())) : undefined;
    return () => { cancelAnimationFrame(raf); unsub?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, onScreen, w, h, still, compact, p, stageScale, tagged]);

  const sentence = useTransform(p, [T.sentence[0], T.sentence[1]], [0, 1]);
  const sentenceOut = useTransform(p, [T.burst[0], T.burst[0] + 0.05], [1, 0]);
  const coreUi = useTransform(p, [T.core[0] + 0.06, T.core[1]], [0, 1]);

  return (
    <div ref={stage} className="relative h-full w-full">
      <div ref={numberEl} className="absolute inset-0 flex flex-col items-center justify-center will-change-transform">
        <div className="flex flex-col items-center">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted">SUBMISSIONS IN QUEUE</span>
          <span ref={valueEl} className="mt-2 text-[clamp(6rem,24vw,22rem)] font-semibold leading-[0.8] tracking-[-0.07em] tabular text-fg">100</span>
        </div>
      </div>
      <motion.p className="absolute inset-x-0 bottom-[12%] mx-auto max-w-[22ch] px-5 text-center text-[clamp(1.5rem,3.4vw,3rem)] font-medium leading-[1.05] tracking-[-0.035em] text-fg" style={{ opacity: sentenceOut }}>
        <ScrubText text="More projects shouldn't mean more chaos." progress={sentence} />
      </motion.p>

      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />

      {/* live status tags */}
      {tagged.map((ri, k) => {
        const pr = PROJECTS[ri];
        const t = TRACKS.findIndex((x) => x.id === pr.trackId);
        return (
          <div key={pr.id} ref={(el) => { tags.current[k] = el; }} aria-hidden
            className="pointer-events-none absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border border-line-strong bg-bg/85 px-1.5 py-[3px] font-mono text-[9px] tracking-[0.1em] text-fg-2 backdrop-blur-sm" style={{ opacity: 0 }}>
            <span className="size-1.5 rounded-full" style={{ background: `rgb(${TRACK_RGB[t]})` }} />
            {pr.status === "draft" ? "DRAFT" : "SUBMITTED"} <span className="text-fg">{pr.name}</span>
          </div>
        );
      })}
      <div ref={focusTag} aria-hidden className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-[3px] border border-accent/60 bg-bg/85 px-1.5 py-[3px] font-mono text-[9px] tracking-[0.1em] text-accent backdrop-blur-sm" style={{ opacity: 0 }}>
        SELECTED · <span className="text-fg">{FEATURED.project.name}</span>
      </div>

      <div ref={tip} className="pointer-events-none absolute left-0 top-0 z-10 w-[240px] rounded-[3px] border border-accent/40 bg-surface p-3 opacity-0 transition-opacity duration-150">
        <p data-m className="font-mono text-[9px] tracking-[0.1em] text-accent" />
        <p data-n className="mt-1 text-[14px] font-semibold text-fg" />
        <p data-t className="mt-1 text-[11.5px] leading-snug text-fg-2" />
      </div>

      {/* heading + legend (hover a track to isolate it) */}
      <motion.div className="absolute inset-x-0 top-[76px] mx-auto flex max-w-[1600px] justify-between px-5 md:top-[92px] md:px-10" style={{ opacity: coreUi }}>
        <div>
          <Tag n="02">Submission core</Tag>
          <h2 className="mt-3 max-w-[16ch] text-[clamp(1.8rem,3.6vw,3.4rem)] font-semibold leading-[0.92] tracking-[-0.045em]">Every submission, in one structured space.</h2>
          <ul className={compact ? "mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5" : "mt-8 space-y-1"}>
            {TRACKS.map((t, i) => (
              <li key={t.id}>
                <button type="button" onPointerEnter={() => setLit(i)} onPointerLeave={() => setLit(-1)} onFocus={() => setLit(i)} onBlur={() => setLit(-1)}
                  className="group flex w-full items-center gap-3 rounded-[3px] py-1 text-left transition-opacity duration-300 md:px-2 md:-mx-2 md:hover:bg-fg/[0.04]"
                  style={{ opacity: lit >= 0 && lit !== i ? 0.4 : 1 }}>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: `rgb(${TRACK_RGB[i]})`, boxShadow: `0 0 10px rgb(${TRACK_RGB[i]} / 0.6)` }} />
                  {!compact && <span className="font-mono text-[10px] tracking-[0.12em] text-muted">{t.code}</span>}
                  <span className="truncate text-[13px] text-fg md:text-[14px]">{t.name}</span>
                  <span className="ml-auto pl-3 font-mono text-[10px] tabular text-fg-2">{pad(trackCounts[i], 2)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden max-w-[44ch] text-right font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-muted md:block">
          {PROJECTS.length} projects · {SUBMITTED.length} submitted · {TRACKS.length} tracks<br />move to tilt · hover a lit node to inspect
        </p>
      </motion.div>
    </div>
  );
}

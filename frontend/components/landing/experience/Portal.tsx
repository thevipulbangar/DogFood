"use client";

import { useEffect, useRef } from "react";
import { clamp, easeOut, useEnv, useOnScreen, useSize } from "./runtime";

/**
 * A ring of light: ~90 hairline strands that each wobble on their own slow
 * phase, lit by one moving source through a conic gradient and summed
 * additively — so the lit side blooms into a silky chrome rim and the far side
 * falls away into darkness. On arrival it grows out of the loader's ring.
 */
export function Portal({ cy = 0.45, bornAt }: { cy?: number; bornAt: number | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { w, h } = useSize(wrap);
  const onScreen = useOnScreen(wrap, "0px");
  const { still, compact, px, py } = useEnv();

  useEffect(() => {
    const c = canvas.current;
    if (!c || !w || !h) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const N = compact ? 54 : 90;
    const SEG = compact ? 72 : 110;
    const R = compact ? Math.min(w * 0.62, h * 0.4) : Math.min(w * 0.43, h * 0.64);
    // deterministic strand personalities
    const strands = Array.from({ length: N }, (_, i) => {
      const r = Math.sin(i * 12.9898) * 43758.5453;
      const f = r - Math.floor(r);
      const g = (Math.sin(i * 78.233) * 12345.678) % 1;
      return {
        off: (f - 0.5) * 0.09,             // radial offset from the main ring
        amp: 0.006 + Math.abs(g) * 0.03,   // wobble size
        freq: 2 + (i % 4),                 // lobes
        speed: 0.05 + f * 0.12,
        phase: f * Math.PI * 2,
        alpha: 0.05 + Math.abs(g) * 0.22,
        width: 0.5 + f * 0.9,
        warm: i % 29 === 7,                // a rare orange filament
      };
    });
    let raf = 0;
    const t0 = performance.now();

    const draw = (time: number) => {
      const t = still ? 8 : (time - t0) / 1000;
      const born = bornAt == null ? 0 : still ? 1 : easeOut(clamp((time - bornAt) / 1500));
      ctx.clearRect(0, 0, w, h);
      if (born <= 0) return;
      const cx = w / 2 + px.get() * 14, cyy = h * cy + py.get() * 10;
      const rad = R * (0.12 + 0.88 * born);
      const light = t * 0.12 + px.get() * 0.5 - 0.6;

      const grad = ctx.createConicGradient(light, cx, cyy);
      grad.addColorStop(0, "rgba(214,232,236,1)");
      grad.addColorStop(0.1, "rgba(170,196,204,0.55)");
      grad.addColorStop(0.32, "rgba(120,140,150,0.08)");
      grad.addColorStop(0.5, "rgba(90,110,120,0.02)");
      grad.addColorStop(0.72, "rgba(120,140,150,0.1)");
      grad.addColorStop(0.9, "rgba(170,196,204,0.5)");
      grad.addColorStop(1, "rgba(214,232,236,1)");

      ctx.globalCompositeOperation = "lighter";
      // bloom: a few wide, faint passes under the strands
      ctx.strokeStyle = grad;
      for (const [lw, a] of [[70, 0.025], [30, 0.04], [10, 0.06]] as const) {
        ctx.globalAlpha = a * born;
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(cx, cyy, rad, 0, Math.PI * 2); ctx.stroke();
      }
      // strands
      for (const s of strands) {
        ctx.globalAlpha = s.alpha * born;
        ctx.lineWidth = s.width;
        ctx.strokeStyle = s.warm ? "rgba(255,110,50,0.9)" : grad;
        ctx.beginPath();
        for (let k = 0; k <= SEG; k++) {
          const a = (k / SEG) * Math.PI * 2;
          const wob = Math.sin(a * s.freq + s.phase + t * s.speed) * s.amp + Math.sin(a * 1 + t * s.speed * 0.7) * s.amp * 0.6;
          const rr = rad * (1 + s.off + wob);
          const x = cx + Math.cos(a) * rr, y = cyy + Math.sin(a) * rr * 0.98;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = (time: number) => { draw(time); raf = requestAnimationFrame(loop); };
    if (onScreen && !still) raf = requestAnimationFrame(loop);
    else draw(performance.now() + 5000);
    return () => cancelAnimationFrame(raf);
  }, [w, h, compact, still, onScreen, bornAt, cy, px, py]);

  return (
    <div ref={wrap} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {/* vignette: the portal sits in a dark room */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgb(10_10_11/0.92)_100%)]" />
      {/* film grain */}
      <div className="absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: "var(--noise)" }} />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";
import type { User } from "@/lib/session";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { Dashboard } from "@/components/dashboard/Dashboards";
import { Analytics } from "@/components/admin/Analytics";
import { easeInOut, lerp, range, useEnv, useProgress, useSize } from "./runtime";

/** Virtual screen the real UI is laid out on: a laptop, or a phone on narrow viewports. */
const DESKTOP_W = 1280;
const PHONE_W = 400;
// Decorative only: this drives the marketing page's scroll-through preview
// of the real Dashboard/Sidebar/Topbar components, not an authenticated
// session — there's no token, so any data fetch these make will just fail
// quietly into their own loading/error states, same as being logged out.
const organizer: User = { id: 0, name: "Preview Organizer", email: "preview@dogfood.local", role: "organizer" };

type Rect = { x: number; y: number; w: number; h: number };
export type Shot = { screen: 0 | 1; target: "top" | "metrics" | { titles: string[] } };

/** Locate a real panel by its visible title, then walk up to its frame. */
function findPanel(root: HTMLElement, title: string) {
  const cands = root.querySelectorAll<HTMLElement>("figcaption span, header h2, h1, p.label");
  for (const el of cands) {
    if (el.textContent?.trim().toLowerCase() === title.toLowerCase()) return el.closest<HTMLElement>("figure, section") ?? el;
  }
  return null;
}

/**
 * The real product — the organizer's Sidebar, Topbar, Dashboard and Analytics
 * components rendering the event's own data — inside a camera rig. Inert:
 * it is shown, not operated, so nothing on the landing page can trigger
 * navigation or app state by accident.
 */
export default function ProductFrame({ tour, shots }: { tour: MotionValue<number>; shots: Shot[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const screens = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const { w: FW, h: FH } = useSize(frame);
  const [rects, setRects] = useState<Rect[] | null>(null);
  const { compact } = useEnv();
  const CANVAS_W = compact ? PHONE_W : DESKTOP_W;

  const measure = useCallback(() => {
    // Layout offsets, not client rects: they ignore every transform (the camera,
    // and the stage scale on short viewports), so they are true canvas coordinates.
    const box = (el: HTMLElement, root: HTMLElement) => {
      let x = 0, y = 0;
      for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop; }
      return { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
    };
    const out: Rect[] = shots.map((s) => {
      const root = screens[s.screen].current;
      const fallback = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_W * (FH / Math.max(1, FW)) };
      if (!root || s.target === "top") return fallback;
      const els = s.target === "metrics" ? [root.querySelector<HTMLElement>("main dl")] : s.target.titles.map((t) => findPanel(root, t));
      const found = els.filter((e): e is HTMLElement => !!e).map((e) => box(e, root));
      if (!found.length) return fallback;
      const x0 = Math.min(...found.map((r) => r.left)), y0 = Math.min(...found.map((r) => r.top));
      const x1 = Math.max(...found.map((r) => r.right)), y1 = Math.max(...found.map((r) => r.bottom));
      const pad = 28;
      return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
    });
    setRects(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, FW, FH, CANVAS_W]);

  // Re-measure whenever the real screens change size (skeleton → content, charts laying out).
  useEffect(() => {
    if (!FW) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    screens.forEach((s) => s.current && ro.observe(s.current));
    const late = setTimeout(measure, 900);
    return () => { ro.disconnect(); clearTimeout(late); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, FW]);

  useProgress(tour, (t) => {
    if (!rects || !FW) return;
    const segs = shots.length - 1;
    const pos = Math.min(segs - 1e-6, Math.max(0, t) * segs);
    const i = Math.floor(pos);
    const e = easeInOut(range(pos - i, 0.3, 1));
    const a = rects[i], b = rects[i + 1];
    const r = { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e) };
    const s = Math.min(FW / r.w, FH / r.h);
    const tx = FW / 2 - (r.x + r.w / 2) * s;
    const ty = FH / 2 - (r.y + r.h / 2) * s;
    const sa = shots[i].screen, sb = shots[i + 1].screen;
    const w1 = lerp(sa, sb, easeInOut(range(pos - i, 0.35, 0.8)));
    screens.forEach((ref, k) => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(5)})`;
      el.style.opacity = String(k === 1 ? w1 : 1 - w1);
      el.style.visibility = (k === 1 ? w1 : 1 - w1) < 0.01 ? "hidden" : "visible";
    });
  }, [rects, FW, FH]);

  return (
    <div ref={frame} className="absolute inset-0 overflow-hidden bg-bg">
      <p className="sr-only">
        Live rendering of the Dogfood organizer dashboard and analytics screens, using the event&apos;s seeded data.
      </p>
      {[<Dashboard key="d" user={organizer} />, <Analytics key="a" />].map((screen, k) => (
        <div key={k} ref={screens[k]} inert aria-hidden
          className="absolute left-0 top-0 origin-top-left will-change-transform select-none"
          style={{ width: CANVAS_W, opacity: k === 0 ? 1 : 0 }}>
          <div className={compact ? "flex min-h-[760px] bg-bg" : "flex min-h-[820px] bg-bg"}>
            <div className="flex self-stretch [&>aside]:static [&>aside]:h-full">
              <Sidebar user={organizer} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="[&>header]:static"><Topbar user={organizer} onOpenPalette={() => {}} /></div>
              <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-16 pt-8 md:px-8 md:pt-10 xl:px-12">{screen}</main>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

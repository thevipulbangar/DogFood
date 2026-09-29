"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { EASE_IO, useEnv } from "./runtime";

const STEPS = ["initializing platform", "loading submission engine", "loading evaluation engine", "loading judging matrix", "system ready"];
const KEY = "dogfood.landing.intro";
const RING = 46; // px — the ring the hero's portal grows out of

/**
 * Near-black, one wordmark, one hairline arc that lengthens as the system
 * loads. When it completes the ring swells outward and the room fades up
 * around it: the hero's portal is this ring, grown. Shown once per session.
 */
export function Loader() {
  const { setReady, still, compact } = useEnv();
  const [phase, setPhase] = useState<"boot" | "open" | "gone">("boot");
  const [pct, setPct] = useState(0);
  const started = useRef(false);

  useLayoutEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch {}
    if (seen || window.scrollY > 40) {
      setPhase("gone");
      setReady(true);
      return;
    }
    started.current = true;
    document.documentElement.style.overflow = "hidden";
  }, [setReady]);

  useEffect(() => {
    if (!started.current || phase !== "boot") return;
    const total = still ? 500 : 2300;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / total);
      setPct(k);
      if (k < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setPhase("open"), still ? 50 : 250);
    };
    raf = requestAnimationFrame(tick);
    // Failsafe: if frames are throttled (background tab, busy machine), never hang.
    const failsafe = setTimeout(() => setPhase("open"), total + 2500);
    return () => { cancelAnimationFrame(raf); clearTimeout(failsafe); };
  }, [phase, still]);

  useEffect(() => {
    if (phase !== "open") return;
    setReady(true); // the portal starts growing underneath as the ring swells
    document.documentElement.style.overflow = "";
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    const id = setTimeout(() => setPhase("gone"), still ? 100 : 1500);
    return () => clearTimeout(id);
  }, [phase, setReady, still]);

  useEffect(() => () => { document.documentElement.style.overflow = ""; }, []);

  if (phase === "gone") return null;
  const open = phase === "open";
  const C = 2 * Math.PI * RING;
  const arc = 0.08 + pct * 0.92;
  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(pct * STEPS.length))];

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={step}
      className="fixed inset-0 z-[80] bg-[#030304]"
      style={{ pointerEvents: open ? "none" : "auto" }}
      animate={open ? { backgroundColor: "rgba(3,3,4,0)" } : { backgroundColor: "rgba(3,3,4,1)" }}
      transition={{ duration: still ? 0.1 : 1.2, ease: EASE_IO }}
    >
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: compact ? "46%" : "45%" }}>
        {/* the ring */}
        <motion.svg width={RING * 2 + 4} height={RING * 2 + 4} viewBox={`0 0 ${RING * 2 + 4} ${RING * 2 + 4}`} aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
          animate={open ? { scale: compact ? 4 : 11, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ duration: still ? 0.1 : 1.3, ease: [0.7, 0, 0.3, 1] }}>
          <circle cx={RING + 2} cy={RING + 2} r={RING} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <g className="origin-center animate-[spin_1.6s_linear_infinite]" style={{ transformBox: "fill-box" }}>
            <circle cx={RING + 2} cy={RING + 2} r={RING} fill="none" stroke="rgba(236,242,244,0.85)" strokeWidth="1"
              strokeLinecap="round" strokeDasharray={`${C * arc} ${C}`} style={{ transition: "stroke-dasharray 120ms linear" }} />
          </g>
        </motion.svg>

        {/* wordmark */}
        <motion.p className="relative whitespace-nowrap font-sans text-[13px] font-medium tracking-[0.42em] text-[#ecf0f1] [padding-left:0.42em]"
          animate={open ? { opacity: 0, filter: "blur(4px)" } : { opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.5 }}>
          DOGFOOD
        </motion.p>
      </div>

      {/* one quiet line of system status */}
      <motion.p className="absolute inset-x-0 bottom-10 text-center font-mono text-[10px] lowercase tracking-[0.18em] text-white/35"
        animate={open ? { opacity: 0 } : { opacity: 1 }} transition={{ duration: 0.4 }}>
        {step} <span className="tabular text-white/55">{String(Math.round(pct * 100)).padStart(3, "0")}</span>
      </motion.p>
    </motion.div>
  );
}

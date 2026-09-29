"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LogoMark } from "@/components/ui/Logo";
import { EventGrid } from "@/components/ui/EventGrid";
import { EVENT } from "@/lib/data";

const LINES = [
  "INITIALIZING EVENT ENGINE",
  "LOADING PROJECT INDEX",
  "LOADING JUDGING ENGINE",
  "VERIFYING LOCAL DATA",
  "SYSTEM READY",
];

/** ~1.6s technical boot sequence, shown once per browser session. */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const step = reduce ? 90 : 260;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown < LINES.length) {
      const id = setTimeout(() => setShown((s) => s + 1), step);
      return () => clearTimeout(id);
    }
    const id = setTimeout(onDone, reduce ? 100 : 320);
    return () => clearTimeout(id);
  }, [shown, step, onDone, reduce]);

  return (
    <motion.div
      role="status"
      aria-label="Loading Dogfood"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden bg-[#050505]"
      exit={{ opacity: 0, filter: "blur(6px)", scale: 1.02 }}
      transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
    >
      <EventGrid cells={10} seed={3} className="opacity-60" />
      {!reduce && <div aria-hidden className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-transparent via-accent/[0.04] to-transparent" />}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgb(255_255_255/0.015)_3px)]" />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative flex flex-col items-center">
        <LogoMark size={36} className="text-fg" />
        <p className="mt-6 font-mono text-[28px] font-semibold tracking-[0.35em] text-fg sm:text-[34px]">DOGFOOD</p>
        <p className="label mt-2">{EVENT.id} · {EVENT.version} · {EVENT.instance}</p>
      </motion.div>

      <div className="relative mt-12 w-[min(360px,86vw)] font-mono text-[11px] tracking-[0.08em]">
        <ul className="space-y-1.5">
          {LINES.map((l, i) => (
            <motion.li
              key={l}
              initial={{ opacity: 0, x: -6 }}
              animate={i < shown ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between"
            >
              <span className={i === LINES.length - 1 ? "text-accent" : "text-fg-2"}>
                {i === LINES.length - 1 ? "● " : "› "}{l}{i < LINES.length - 1 && "..."}
              </span>
              <span className="text-muted">{i === LINES.length - 1 ? "" : "OK"}</span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-6 h-px w-full bg-white/10">
          <motion.div className="h-px bg-accent" animate={{ width: `${(shown / LINES.length) * 100}%` }} transition={{ duration: 0.25 }} />
        </div>
        <p className="mt-2 flex justify-between text-[10px] text-muted">
          <span>LOCAL INSTANCE · NO NETWORK REQUIRED</span>
          <span className="tabular">{Math.round((shown / LINES.length) * 100)}%</span>
        </p>
      </div>
    </motion.div>
  );
}

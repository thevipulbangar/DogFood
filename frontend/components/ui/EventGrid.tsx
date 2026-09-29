"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { mulberry32, cn } from "@/lib/utils";

/**
 * THE EVENT GRID — the signature motif. A technical lattice where lit cells
 * stand for projects, teams, judges and scores moving through the event.
 */
export function EventGrid({ cells = 18, seed = 7, className, size = 48, fade = true }: {
  cells?: number; seed?: number; className?: string; size?: number; fade?: boolean;
}) {
  const reduce = useReducedMotion();
  const lit = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: cells }, () => ({
      x: Math.floor(r() * 32),
      y: Math.floor(r() * 18),
      delay: r() * 6,
      dur: 3 + r() * 4,
      accent: r() < 0.35,
    }));
  }, [cells, seed]);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", fade && "fade-mask-radial", className)}>
      <div className="event-grid absolute inset-0" style={{ ["--grid-size" as string]: `${size}px` }} />
      {lit.map((c, i) => (
        <motion.span
          key={i}
          className={cn("absolute", c.accent ? "bg-accent/25" : "bg-white/[0.05]")}
          style={{ left: c.x * size + 1, top: c.y * size + 1, width: size - 1, height: size - 1 }}
          initial={{ opacity: 0 }}
          animate={reduce ? { opacity: 0.6 } : { opacity: [0, 1, 0] }}
          transition={reduce ? undefined : { duration: c.dur, delay: c.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/** Count-up number, triggered when scrolled into view. */
export function Counter({ value, decimals = 0, suffix = "", duration = 1.2, className }: {
  value: number; decimals?: number; suffix?: string; duration?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const c = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setDisplay });
    return () => c.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      <span aria-hidden>{display.toFixed(decimals)}{suffix}</span>
      <span className="sr-only">{value.toFixed(decimals)}{suffix}</span>
    </span>
  );
}

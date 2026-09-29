"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { EVENT } from "@/lib/data";
import { useNow } from "@/lib/hooks";
import { fmtUTC, splitDuration, pad } from "@/lib/utils";
import { EventGrid } from "@/components/ui/EventGrid";
import { Magnetic, StatusDot, buttonClass } from "@/components/ui/primitives";

const LINES = ["BUILD THE", "PLATFORM", "THAT WILL", "JUDGE YOU"];
const TAGS = ["DOGFOOD 2026", "72 HOURS", "GLOBAL", "OPEN SOURCE", "SELF-HOSTED"];
const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const now = useNow();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const deadline = Date.parse(EVENT.deadline);
  const left = now ? splitDuration(deadline - now) : null;
  const closed = now != null && now >= deadline;

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden border-b border-line">
      <motion.div style={{ y: gridY }} className="absolute inset-0">
        <EventGrid cells={28} seed={2026} size={56} />
      </motion.div>
      <div aria-hidden className="pointer-events-none absolute -right-40 top-1/3 size-[520px] rounded-full bg-accent/[0.07] blur-[140px]" />

      {/* Technical frame metadata */}
      <div className="relative mx-auto flex w-full max-w-[1600px] items-center justify-between px-5 pt-24 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted md:px-10 md:pt-28">
        <span>{EVENT.id} / FIG. 01</span>
        <span className="hidden sm:inline">LAT 00.000 · LON 00.000 · GLOBAL</span>
        <span className="tabular">{now ? fmtUTC(new Date(now).toISOString(), "clock") : "--:--:--"} UTC</span>
      </div>

      <motion.div style={{ y, opacity, scale }} className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-5 py-10 md:px-10">
        <h1 aria-label="Build the platform that will judge you." className="font-semibold leading-[0.84] tracking-[-0.055em] text-fg">
          {LINES.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.04em]">
              <motion.span
                className="block text-[clamp(3.4rem,min(12.5vw,15.5vh),12.5rem)]"
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.09, ease }}
              >
                {line}
                {i === LINES.length - 1 && <span className="text-accent">.</span>}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease }}
          className="mt-8 grid gap-8 md:mt-10 md:grid-cols-[1fr_auto] md:items-end"
        >
          <div>
            <ul className="flex flex-wrap border-y border-line">
              {TAGS.map((t) => (
                <li key={t} className="border-r border-line px-3 py-2 font-mono text-[10.5px] tracking-[0.1em] text-fg-2 last:border-r-0 sm:px-4">{t}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="inline-flex items-center gap-2 rounded-xs border border-ok/25 bg-ok/10 px-2 py-1 font-mono text-[11px] tracking-[0.1em] text-ok">
                <StatusDot tone="ok" pulse /> {closed ? "JUDGING" : "LIVE"}
              </span>
              <span className="font-mono text-[12px] tracking-[0.04em] text-fg-2">September 25 — September 28, 2026</span>
              <span className="font-mono text-[12px] tabular text-muted" aria-live="off">
                {closed ? "SUBMISSIONS CLOSED" : left ? `CLOSES IN ${pad(left.days, 2)}D ${pad(left.hours, 2)}H ${pad(left.minutes, 2)}M ${pad(left.seconds, 2)}S` : "CLOSES IN --"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Magnetic>
              <Link href="/signin" className={buttonClass("primary", "lg")}>Enter Dogfood <ArrowRight className="size-4" /></Link>
            </Magnetic>
            <Magnetic>
              <Link href="/gallery" className={buttonClass("outline", "lg")}>Explore projects</Link>
            </Magnetic>
          </div>
        </motion.div>
      </motion.div>

      <div className="relative mx-auto flex w-full max-w-[1600px] items-center justify-between px-5 pb-6 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted md:px-10">
        <span>{EVENT.instance} · {EVENT.version}</span>
        <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 2, repeat: Infinity }} className="flex items-center gap-2">
          Scroll <ArrowDown className="size-3" />
        </motion.span>
      </div>
    </section>
  );
}

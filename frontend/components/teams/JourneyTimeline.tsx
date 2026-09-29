"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Team created", "Project started", "Submission draft", "Submitted", "Judging", "Results"];

/** The lifecycle as a progress rail. Horizontal on desktop, vertical on mobile. */
export function JourneyTimeline({ current }: { current: number }) {
  const pct = (current / (STEPS.length - 1)) * 100;
  const fill = `calc(${pct}% - ${(pct / 100) * 16}px)`;
  const t = { duration: 1.1, ease: [0.16, 1, 0.3, 1] as const };
  return (
    <ol className="relative grid gap-5 md:grid-cols-6 md:gap-0">
      <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-px bg-line-strong md:hidden" />
      <span aria-hidden className="absolute left-2 right-[calc(100%/6-8px)] top-[7px] hidden h-px bg-line-strong md:block" />
      <motion.span aria-hidden className="absolute left-[7px] top-2 w-px bg-accent md:hidden" initial={{ height: 0 }} whileInView={{ height: fill }} viewport={{ once: true }} transition={t} />
      <motion.span aria-hidden className="absolute left-2 top-[7px] hidden h-px bg-accent md:block" initial={{ width: 0 }} whileInView={{ width: `calc((100% - 100%/6) * ${pct / 100})` }} viewport={{ once: true }} transition={t} />
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} className="relative flex items-center gap-3 md:flex-col md:items-start" aria-current={state === "current" ? "step" : undefined}>
            <span className={cn("relative z-10 flex size-[15px] shrink-0 items-center justify-center rounded-full border",
              state === "done" && "border-fg-2 bg-fg-2 text-bg", state === "current" && "border-accent bg-bg", state === "todo" && "border-line-strong bg-bg")}>
              {state === "done" && <Check className="size-2.5" strokeWidth={3} />}
              {state === "current" && <span className="size-[7px] animate-pulse-dot rounded-full bg-accent text-accent" />}
            </span>
            <span>
              <span className={cn("block font-mono text-[10.5px] uppercase tracking-[0.1em]", state === "todo" ? "text-muted" : "text-fg")}>{s}</span>
              <span className="block font-mono text-[10px] text-muted">{state === "done" ? "Complete" : state === "current" ? "In progress" : "Upcoming"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

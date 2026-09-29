"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useNow } from "@/lib/hooks";
import { cn, pad, splitDuration } from "@/lib/utils";
import { Counter } from "@/components/ui/Counter";
import { Badge, StatusDot } from "@/components/ui/primitives";

export function Greeting({ name, sub }: { name: string; sub: string }) {
  const now = useNow(60_000);
  const h = now ? new Date(now).getHours() : null;
  const part = h == null ? "Hello" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return (
    <header className="mb-8 md:mb-10">
      <p className="label flex items-center gap-2"><StatusDot tone="ok" pulse />Dogfood 2026 · {sub}</p>
      <h1 className="mt-3 text-[clamp(2rem,4.8vw,3.75rem)] font-semibold uppercase leading-[0.92] tracking-[-0.04em]">
        {part},<br className="sm:hidden" /> <span className="text-fg-2">{name.split(" ")[0]}</span>
      </h1>
    </header>
  );
}

/** Flip-style digit block. Only changed digits animate. */
function Digits({ value, label, big }: { value: number; label: string; big?: boolean }) {
  const s = pad(value, 2);
  return (
    <div className="flex flex-col">
      <div className={cn("flex overflow-hidden font-semibold tabular leading-none tracking-[-0.04em]", big ? "text-[clamp(3.2rem,7vw,6rem)]" : "text-4xl")}>
        {s.split("").map((d, i) => (
          <span key={i} className="relative inline-block overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={d} className="inline-block" initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                {d}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </div>
      <span className="label mt-2">{label}</span>
    </div>
  );
}

export function Countdown({ to, big = true, seconds }: { to: string; big?: boolean; seconds?: boolean }) {
  const now = useNow();
  const t = splitDuration(now ? Date.parse(to) - now : 0);
  const Sep = () => <span aria-hidden className={cn("font-light text-line-strong", big ? "text-[clamp(3rem,6vw,5rem)] leading-none" : "text-3xl")}>:</span>;
  return (
    <div role="timer" aria-label={`${t.days} days ${t.hours} hours ${t.minutes} minutes remaining`} className="flex items-start gap-3 md:gap-5">
      <Digits value={t.days} label="Days" big={big} /><Sep />
      <Digits value={t.hours} label="Hours" big={big} /><Sep />
      <Digits value={t.minutes} label="Minutes" big={big} />
      {seconds && <><Sep /><Digits value={t.seconds} label="Seconds" big={big} /></>}
    </div>
  );
}

/**
 * Real deadline countdown — takes the actual event/team deadline as a
 * prop instead of a hardcoded date. Callers with no deadline in scope
 * (e.g. an organizer with several events open) should not render this.
 */
export function EventStatus({ deadline, title = "Submissions close in" }: { deadline: string; title?: string }) {
  const now = useNow(30_000);
  const closed = now != null && now >= Date.parse(deadline);

  return (
    <section aria-label="Event status" className="relative overflow-hidden rounded-md border border-line bg-surface/70">
      <div className="relative p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="label text-fg-2">Event status</span>
          <Badge tone={closed ? "warn" : "ok"} dot pulse>{closed ? "Submissions closed" : "Live"}</Badge>
        </div>
        <p className="label mt-8">{closed ? "Submissions closed" : title}</p>
        <div className="mt-3">{closed ? <p className="text-5xl font-semibold tracking-tight">Locked</p> : <Countdown to={deadline} />}</div>
        <p className="mt-5 font-mono text-[11.5px] text-muted">DEADLINE {new Date(deadline).toUTCString()}</p>
      </div>
    </section>
  );
}

export function MetricStrip({ items }: { items: { k: string; v: number; suffix?: string; decimals?: number; delta?: string; href?: string }[] }) {
  return (
    <dl className="no-scrollbar -mx-4 flex snap-x overflow-x-auto border-y border-line px-4 md:mx-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] md:overflow-visible md:rounded-md md:border md:px-0">
      {items.map((m) => {
        const body = (
          <>
            <dt className="label">{m.k}</dt>
            <dd className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-semibold leading-none tracking-[-0.04em]">
              <Counter value={m.v} suffix={m.suffix} decimals={m.decimals} />
            </dd>
            {m.delta && <dd className="mt-2 font-mono text-[10.5px] text-muted">{m.delta}</dd>}
          </>
        );
        return (
          <div key={m.k} className="min-w-[46%] snap-start border-r border-line last:border-r-0 sm:min-w-[30%] md:min-w-0">
            {m.href ? <Link href={m.href} className="block p-4 transition-colors hover:bg-white/[0.02] md:p-5">{body}</Link> : <div className="p-4 md:p-5">{body}</div>}
          </div>
        );
      })}
    </dl>
  );
}

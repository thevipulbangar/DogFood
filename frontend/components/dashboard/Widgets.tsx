"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { EVENT, AUDIT } from "@/lib/data";
import { useNow } from "@/lib/hooks";
import { cn, fmtUTC, pad, splitDuration } from "@/lib/utils";
import { Counter } from "@/components/ui/Counter";
import { EventGrid } from "@/components/ui/EventGrid";
import { Badge, StatusDot, Ticks } from "@/components/ui/primitives";

export function Greeting({ name, sub }: { name: string; sub: string }) {
  const now = useNow(60_000);
  const h = now ? new Date(now).getHours() : null;
  const part = h == null ? "Hello" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return (
    <header className="mb-8 md:mb-10">
      <p className="label flex items-center gap-2"><StatusDot tone="ok" pulse />{EVENT.name} · {sub}</p>
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

const PHASES = [
  { k: "REGISTRATION", at: "2026-09-10T00:00:00Z" },
  { k: "BUILD", at: EVENT.startsAt },
  { k: "SUBMISSIONS CLOSE", at: EVENT.deadline },
  { k: "JUDGING", at: EVENT.deadline },
  { k: "RESULTS", at: EVENT.resultsAt },
];

export function EventStatus({ title = "Submissions close in" }: { title?: string }) {
  const now = useNow(30_000);
  const closed = now != null && now >= Date.parse(EVENT.deadline);
  const current = now == null ? 1 : PHASES.reduce((acc, p, i) => (now >= Date.parse(p.at) ? i : acc), 0);

  return (
    <section aria-label="Event status" className="relative overflow-hidden rounded-md border border-line bg-surface/70">
      <Ticks />
      <EventGrid cells={8} seed={21} size={40} className="opacity-70" />
      <div className="relative grid gap-8 p-5 md:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="label text-fg-2">Event status</span>
            <Badge tone={closed ? "warn" : "ok"} dot pulse>{closed ? "Judging" : "Live"}</Badge>
            <span className="label">{EVENT.id}</span>
          </div>
          <p className="label mt-8">{closed ? "Submissions closed" : title}</p>
          <div className="mt-3">{closed ? <p className="text-5xl font-semibold tracking-tight">Locked</p> : <Countdown to={EVENT.deadline} />}</div>
          <p className="mt-5 font-mono text-[11.5px] text-muted">DEADLINE {fmtUTC(EVENT.deadline)} · SERVER-AUTHORITATIVE CLOCK</p>
        </div>
        <ol className="grid grid-cols-5 gap-2 lg:w-[420px] lg:grid-cols-1 lg:gap-0">
          {PHASES.map((p, i) => (
            <li key={p.k} className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 lg:border-l lg:border-line lg:py-2 lg:pl-4">
              <span className={cn("h-0.5 w-full rounded-full lg:size-1.5 lg:-ml-[19px] lg:w-1.5", i < current ? "bg-fg-2" : i === current ? "bg-accent" : "bg-line-strong")} />
              <span className={cn("hidden font-mono text-[10.5px] tracking-[0.08em] lg:inline", i === current ? "text-fg" : "text-muted")}>{p.k}</span>
              <span className="hidden font-mono text-[10px] text-muted lg:ml-auto lg:inline">{fmtUTC(p.at, "date")}</span>
              {i < current && <Check className="hidden size-3 text-muted lg:block" />}
            </li>
          ))}
        </ol>
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

export function ActivityFeed({ limit = 8 }: { limit?: number }) {
  return (
    <ol className="divide-y divide-line">
      {AUDIT.slice(0, limit).map((e, i) => (
        <motion.li key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
          className="grid grid-cols-[64px_1fr] gap-3 py-2.5 font-mono text-[11px] sm:grid-cols-[64px_130px_1fr_auto]">
          <span className="text-muted tabular">{fmtUTC(e.at, "clock")}</span>
          <span className="truncate text-fg-2">{e.actor}</span>
          <span className={cn("col-start-2 truncate sm:col-start-auto", e.action.includes("REJECT") || e.action.includes("RATE") ? "text-warn" : "text-fg")}>{e.action}</span>
          <span className="col-start-2 text-muted sm:col-start-auto">{e.object}</span>
        </motion.li>
      ))}
    </ol>
  );
}

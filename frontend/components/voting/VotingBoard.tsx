"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, EyeOff, Info, Shuffle, ShieldAlert, Timer } from "lucide-react";
import { AUDIT, EVENT, SUBMITTED, VOTING_ACTIVITY, teamById, type User } from "@/lib/data";
import { cn, fmtUTC, hash, mulberry32 } from "@/lib/utils";
import { ProjectPreview } from "@/components/ui/ProjectPreview";
import { Badge, Button, Panel, StatusDot } from "@/components/ui/primitives";
import { AreaChart, ChartFrame } from "@/components/charts/Charts";
import { MetricStrip } from "@/components/dashboard/Widgets";
import { useToast } from "@/components/ui/Toast";

const MAX_VOTES = 3;
const COOLDOWN_MS = 2000;
const VOTING_CLOSES = "2026-09-30T12:00:00Z";

function shuffled<T>(arr: T[], seed: number) {
  const r = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function VotingBoard({ user }: { user: User }) {
  const toast = useToast();
  const staff = user.role === "organizer" || user.role === "admin";
  const eligible = user.role === "participant";
  const seed = hash(user.id + EVENT.id);
  const order = useMemo(() => shuffled(SUBMITTED, seed), [seed]);
  const storageKey = `dogfood.votes.${user.id}`;

  const [votes, setVotes] = useState<number[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const last = useRef(0);

  useEffect(() => {
    try { setVotes(JSON.parse(localStorage.getItem(storageKey) ?? "[]")); } catch {}
  }, [storageKey]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 100)), 100);
    return () => clearTimeout(id);
  }, [cooldown]);

  const persist = (v: number[]) => { setVotes(v); try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch {} };

  const toggle = (id: number) => {
    const since = Date.now() - last.current;
    if (since < COOLDOWN_MS) {
      setCooldown(COOLDOWN_MS - since);
      toast({ tone: "warn", title: "Slow down", body: "RATE_LIMIT · 1 vote action / 2s" });
      return;
    }
    last.current = Date.now();
    if (votes.includes(id)) {
      persist(votes.filter((v) => v !== id));
      toast({ tone: "info", title: "Vote retracted", body: "VOTE_RETRACTED · audit logged" });
    } else if (votes.length >= MAX_VOTES) {
      toast({ tone: "warn", title: "No votes left", body: `Retract a vote to choose another. ${MAX_VOTES} max.` });
    } else {
      persist([...votes, id]);
      toast({ tone: "ok", title: "Vote recorded", body: `${MAX_VOTES - votes.length - 1} of ${MAX_VOTES} votes left` });
    }
  };

  const abuse = AUDIT.filter((e) => e.action.startsWith("VOTE") || e.action === "RATE_LIMIT_TRIGGERED");
  const totalVotes = VOTING_ACTIVITY.reduce((s, h) => s + h.value, 0);

  return (
    <>
      <header className="relative mb-10 overflow-hidden">
        <p className="label flex items-center gap-2"><StatusDot tone="ok" pulse />Community vote · open until {fmtUTC(VOTING_CLOSES)}</p>
        <h1 className="mt-3 text-[clamp(3rem,9vw,7.5rem)] font-semibold leading-[0.85] tracking-[-0.055em]">
          Vote for<br />the people&apos;s<br /><span className="text-accent">choice.</span>
        </h1>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="flex items-center gap-2"><Shuffle className="size-3.5" />Order randomized · seed {seed.toString(16).slice(0, 4).toUpperCase()}</span>
          <span className="flex items-center gap-2"><EyeOff className="size-3.5" />Tally hidden until results</span>
          <span className="flex items-center gap-2"><Timer className="size-3.5" />1 action / 2s</span>
        </div>
      </header>

      {staff && (
        <section aria-label="Anti-abuse" className="mb-10 space-y-6">
          <div className="flex items-center gap-2"><ShieldAlert className="size-4 text-warn" /><h2 className="label text-fg-2">Organizer · integrity monitor</h2><Badge>Internal</Badge></div>
          <MetricStrip items={[
            { k: "Votes cast", v: totalVotes, delta: "last 24h" },
            { k: "Unique voters", v: Math.round(totalVotes / 2.4) },
            { k: "Rate limited", v: abuse.filter((e) => e.action === "RATE_LIMIT_TRIGGERED").length * 7 },
            { k: "Duplicates", v: abuse.filter((e) => e.action === "VOTE_REJECTED_DUPLICATE").length * 5, delta: "rejected" },
            { k: "Quarantined", v: 12, delta: "awaiting review" },
          ]} />
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <ChartFrame title="Voting activity" meta="Votes / hour · UTC">
              <AreaChart data={VOTING_ACTIVITY} height={200} caption="Community votes per hour" />
            </ChartFrame>
            <Panel title="Integrity events" meta="AUDIT" bodyClassName="px-4 py-1">
              <ol className="divide-y divide-line font-mono text-[11px]">
                {abuse.slice(0, 7).map((e) => (
                  <li key={e.id} className="grid grid-cols-[62px_1fr] gap-2 py-2.5">
                    <span className="text-muted">{fmtUTC(e.at, "clock")}</span>
                    <span><span className={e.action === "VOTE_CAST" ? "text-fg" : "text-warn"}>{e.action}</span><span className="block text-muted">{e.actor} · {e.detail}</span></span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted"><Info className="size-3.5" />Tallies are sealed for organizers too. They unlock only when results are published.</p>
        </section>
      )}

      {!eligible && (
        <div className="mb-8 flex items-start gap-3 rounded-md border border-line-strong bg-surface/70 p-4 text-[13.5px]" role="note">
          <Info className="mt-0.5 size-4 shrink-0 text-steel" />
          <p className="text-fg-2">{user.role === "judge" ? "Judges cannot vote in the community round, to keep the two scoring channels independent." : "Staff accounts cannot vote. You are viewing the public voting experience."}</p>
        </div>
      )}

      {eligible && (
        <div className="sticky top-14 z-20 -mx-4 mb-6 flex items-center justify-between gap-4 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl md:mx-0 md:rounded-md md:border">
          <div className="flex items-center gap-3">
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: MAX_VOTES }, (_, i) => (
                <motion.span key={i} className={cn("size-2.5 rounded-xs border", i < votes.length ? "border-accent bg-accent" : "border-line-strong")} animate={i < votes.length ? { scale: [1, 1.4, 1] } : {}} />
              ))}
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2" aria-live="polite">{MAX_VOTES - votes.length} of {MAX_VOTES} votes left</p>
          </div>
          <AnimatePresence>
            {cooldown > 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-mono text-[11px] text-warn" role="status">
                RATE LIMITED · {(cooldown / 1000).toFixed(1)}s
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      <ul className="grid gap-5 md:grid-cols-2">
        {order.map((p, i) => {
          const team = teamById(p.teamId);
          const voted = votes.includes(p.id);
          const own = user.teamId === p.teamId;
          return (
            <motion.li key={p.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.6, delay: (i % 2) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className={cn("group relative flex flex-col overflow-hidden rounded-md border bg-surface/70 transition-colors", voted ? "border-accent/60" : "border-line hover:border-line-strong")}>
              {voted && <motion.span layoutId={`v-${p.id}`} className="absolute inset-x-0 top-0 z-10 h-0.5 bg-accent" />}
              <Link href={`/projects/${p.id}`} className="relative block aspect-[16/8] overflow-hidden border-b border-line">
                <div className="h-full transition-transform duration-700 group-hover:scale-[1.03]"><ProjectPreview seed={p.slug} animated /></div>
              </Link>
              <div className="flex flex-1 flex-col p-5 md:p-6">
                <p className="font-mono text-[10.5px] tracking-[0.1em] text-muted">{p.code} · {team.name.toUpperCase()}</p>
                <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em]">{p.name}</h2>
                <p className="mt-3 text-[14.5px] leading-relaxed text-fg-2">{p.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-1">{p.stack.map((s) => <span key={s} className="rounded-xs border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">{s}</span>)}</div>
                <div className="mt-auto pt-6">
                  {eligible ? (
                    <Button size="lg" variant={voted ? "primary" : "outline"} className="w-full" disabled={own} aria-pressed={voted} onClick={() => toggle(p.id)}>
                      {own ? "Your team" : voted ? <><Check className="size-4" />Voted · click to retract</> : "Vote"}
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" className="w-full" disabled>Vote</Button>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}

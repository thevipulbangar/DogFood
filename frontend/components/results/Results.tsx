"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Award, Download, Eye, Lock, RotateCcw, ArrowUpRight } from "lucide-react";
import { ASSIGNMENTS, EVENT, LEADERBOARD, PRIZES, TRACKS, teamById, trackById, type User } from "@/lib/data";
import { cn, downloadCSV, fmtUTC, pad } from "@/lib/utils";
import { EventGrid } from "@/components/ui/EventGrid";
import { Badge, Button, buttonClass } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Countdown } from "@/components/dashboard/Widgets";
import { useToast } from "@/components/ui/Toast";

const ease = [0.16, 1, 0.3, 1] as const;

function Sealed() {
  return (
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-md border border-line px-6 py-20 text-center">
      <EventGrid cells={16} seed={30} />
      <div className="relative">
        <div className="mx-auto flex size-12 items-center justify-center rounded-sm border border-line-strong bg-surface-2"><Lock className="size-5 text-fg-2" /></div>
        <p className="label mt-8">{EVENT.name} · Results</p>
        <h1 className="mt-3 text-[clamp(3rem,9vw,7rem)] font-semibold leading-[0.85] tracking-[-0.055em]">Sealed<span className="text-accent">.</span></h1>
        <p className="mx-auto mt-5 max-w-md text-[15px] text-fg-2">Scores stay hidden until every judge has submitted and normalization is complete. Results publish in:</p>
        <div className="mt-8 flex justify-center"><Countdown to={EVENT.resultsAt} big={false} /></div>
        <p className="mt-6 font-mono text-[11px] text-muted">{fmtUTC(EVENT.resultsAt).toUpperCase()}</p>
      </div>
    </section>
  );
}

function prizeWinners() {
  const used = new Set<number>();
  const pick = (trackId: string | null) => {
    const r = LEADERBOARD.find((x) => !used.has(x.project.id) && (!trackId || x.project.trackId === trackId));
    if (r) used.add(r.project.id);
    return r;
  };
  const grand = pick(null);
  const tracks = PRIZES.filter((p) => p.trackId).map((p) => ({ prize: p, row: pick(p.trackId) }));
  const people = LEADERBOARD[6];
  return { grand, tracks, people };
}

export function Results({ user }: { user: User }) {
  const toast = useToast();
  const staff = user.role === "organizer" || user.role === "admin";
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState(0);
  const [mode, setMode] = useState<"normalized" | "raw">("normalized");
  const coverage = ASSIGNMENTS.filter((a) => a.status === "submitted").length / ASSIGNMENTS.length;
  const winners = useMemo(prizeWinners, []);
  const podium = LEADERBOARD.slice(0, 3);
  const ranking = useMemo(() => [...LEADERBOARD].sort((a, b) => b[mode] - a[mode]), [mode]);

  useEffect(() => {
    if (!staff) return;
    setStage(0);
    const t = [setTimeout(() => setStage(1), 1500), setTimeout(() => setStage(2), 2300)];
    return () => t.forEach(clearTimeout);
  }, [run, staff]);

  if (!staff) return <Sealed />;

  const exportResults = () => {
    downloadCSV("dogfood-2026-results.csv", LEADERBOARD.map((r, i) => ({
      rank: i + 1, project_id: r.project.id, project: r.project.name, team: teamById(r.project.teamId).name,
      track: trackById(r.project.trackId).name, raw: r.raw.toFixed(3), normalized: r.normalized.toFixed(3), judges: r.count,
    })));
    toast({ tone: "ok", title: "Results exported", body: `dogfood-2026-results.csv · ${LEADERBOARD.length} rows` });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warn/30 bg-warn/[0.05] px-4 py-3">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-warn"><Eye className="size-3.5" />Preview · not published · organizers only</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setRun((r) => r + 1)}><RotateCcw className="size-3" />Replay</Button>
          <Button size="sm" onClick={exportResults}><Download className="size-3" />Download results</Button>
          <Button size="sm" variant="primary" disabled={coverage < 1} title={coverage < 1 ? "All assignments must be scored first" : undefined}>
            Publish · {Math.round(coverage * 100)}% scored
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.section key={`intro-${run}`} exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }} transition={{ duration: 0.6, ease }}
            className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-md border border-line bg-[#060606]">
            <EventGrid cells={22} seed={run + 5} />
            <motion.p initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.3em" }} transition={{ duration: 1.2, ease }}
              className="relative font-mono text-[13px] text-fg-2">DOGFOOD 2026</motion.p>
            <div className="relative overflow-hidden">
              <motion.h1 initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.2, ease }}
                className="mt-2 text-[clamp(4rem,14vw,13rem)] font-semibold leading-[0.9] tracking-[-0.06em]">RESULTS</motion.h1>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {stage >= 1 && (
        <motion.div key={`main-${run}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          <header className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="label">{EVENT.name} · {LEADERBOARD.length} ranked projects · normalized</p>
              <h1 className="mt-2 text-[clamp(3rem,8vw,6.5rem)] font-semibold leading-[0.85] tracking-[-0.055em]">Final results</h1>
            </div>
            <Link href="/judging" className="label flex items-center gap-1 hover:text-fg">Scoring breakdown <ArrowUpRight className="size-3" /></Link>
          </header>

          {/* Podium: revealed 3 → 2 → 1 */}
          <ol className="grid gap-4 lg:grid-cols-3">
            {podium.map((r, i) => {
              const revealOrder = [2, 1, 0][i];
              const prize = i === 0 ? PRIZES[0] : null;
              return (
                <motion.li key={r.project.id} initial={{ opacity: 0, y: 40 }} animate={stage >= 2 ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.9, delay: revealOrder * 0.55, ease }}
                  className={cn("relative flex flex-col overflow-hidden rounded-md border p-6 md:p-8", i === 0 ? "border-accent/50 bg-accent/[0.04] lg:order-2 lg:-mt-6" : i === 1 ? "border-line bg-surface/70 lg:order-1" : "border-line bg-surface/70 lg:order-3")}>
                  {i === 0 && <EventGrid cells={6} seed={1} size={36} className="opacity-60" />}
                  <div className="relative flex items-start justify-between">
                    <span className={cn("font-mono text-[clamp(4.5rem,9vw,7.5rem)] font-semibold leading-[0.8] tracking-[-0.06em]", i === 0 ? "text-accent" : "text-fg")}>{i + 1}</span>
                    {prize && <Badge tone="accent">{prize.name} · {prize.amount}</Badge>}
                  </div>
                  <p className="relative mt-8 font-mono text-[10.5px] tracking-[0.1em] text-muted">{r.project.code} · {trackById(r.project.trackId).name.toUpperCase()}</p>
                  <h2 className="relative mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">{r.project.name}</h2>
                  <p className="relative mt-2 text-[14px] text-fg-2">{teamById(r.project.teamId).name}</p>
                  <div className="relative mt-6 flex items-end justify-between border-t border-line pt-4">
                    <span><span className="label block">Score</span><span className="font-mono text-3xl tabular">{r.normalized.toFixed(2)}</span></span>
                    <span className="flex gap-1.5">
                      <Link href={`/projects/${r.project.id}`} className={buttonClass("secondary", "sm")}>View project</Link>
                      <Link href="/certificates" className={buttonClass("ghost", "sm")} aria-label="View certificate"><Award className="size-3.5" /></Link>
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </ol>

          {/* Prizes */}
          <motion.section initial={{ opacity: 0 }} animate={stage >= 2 ? { opacity: 1 } : {}} transition={{ delay: 1.8 }} className="mt-14">
            <h2 className="label mb-4 text-fg-2">Prizes</h2>
            <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
              {[...winners.tracks.map((t) => ({ name: t.prize.name, amount: t.prize.amount, row: t.row })), { name: "People's Choice", amount: PRIZES[4].amount, row: winners.people }].map((w) => (
                <li key={w.name} className="bg-surface p-5">
                  <p className="label">{w.name} · {w.amount}</p>
                  <p className="mt-3 text-xl font-semibold tracking-tight">{w.row?.project.name ?? "—"}</p>
                  <p className="text-[13px] text-muted">{w.row && teamById(w.row.project.teamId).name}</p>
                </li>
              ))}
            </ul>
          </motion.section>

          {/* Full ranking with animated reordering */}
          <motion.section initial={{ opacity: 0 }} animate={stage >= 2 ? { opacity: 1 } : {}} transition={{ delay: 2 }} className="mt-14">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <h2 className="label text-fg-2">Full ranking</h2>
              <Tabs size="sm" className="border-0" value={mode} onChange={setMode} tabs={[{ id: "normalized", label: "Normalized" }, { id: "raw", label: "Raw" }]} />
            </div>
            <LayoutGroup>
              <ol className="overflow-hidden rounded-md border border-line">
                {ranking.map((r, i) => (
                  <motion.li layout key={r.project.id} transition={{ type: "spring", stiffness: 300, damping: 34 }}
                    className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-line bg-surface/70 px-4 py-3 last:border-0 md:grid-cols-[56px_1fr_180px_110px_110px]">
                    <span className={cn("font-mono text-[15px] tabular", i < 3 ? "text-accent" : "text-muted")}>{pad(i + 1, 2)}</span>
                    <Link href={`/projects/${r.project.id}`} className="min-w-0 hover:text-accent">
                      <span className="block truncate text-[14.5px] font-medium">{r.project.name}</span>
                      <span className="block truncate text-[12px] text-muted">{teamById(r.project.teamId).name}</span>
                    </Link>
                    <span className="hidden truncate font-mono text-[11px] text-muted md:block">{TRACKS.find((t) => t.id === r.project.trackId)?.name}</span>
                    <span className={cn("hidden text-right font-mono text-[12px] tabular md:block", mode === "raw" ? "text-fg" : "text-muted")}>{r.raw.toFixed(2)}</span>
                    <span className={cn("text-right font-mono text-[13px] tabular", mode === "normalized" ? "text-fg" : "text-muted")}>{r.normalized.toFixed(2)}</span>
                  </motion.li>
                ))}
              </ol>
            </LayoutGroup>
          </motion.section>
        </motion.div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Play } from "lucide-react";
import { JUDGES, RUBRIC, projectById, teamById, trackById, type AssignmentStatus } from "@/lib/data";
import type { User } from "@/lib/session";
import { useJudgeAssignments } from "@/lib/judging-store";
import { weightedScore } from "@/lib/scoring";
import { useHotkeys } from "@/lib/hooks";
import { cn, pad } from "@/lib/utils";
import { Counter } from "@/components/ui/Counter";
import { Tabs } from "@/components/ui/Tabs";
import { Badge, Kbd, Meter, Panel, buttonClass, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Greeting } from "@/components/dashboard/Widgets";

export const STATUS_META: Record<AssignmentStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "warn" },
  submitted: { label: "Submitted", tone: "ok" },
  flagged: { label: "Flagged", tone: "danger" },
};

type Filter = "all" | AssignmentStatus;

export function JudgeDashboard({ user }: { user: User }) {
  const router = useRouter();
  // Judging still runs on mock assignment data (not wired to the backend
  // yet) — a real account has no judgeId, so fall back to a mock one.
  const judgeId = JUDGES[0].id;
  const rows = useJudgeAssignments(judgeId);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState(0);

  const done = rows.filter((a) => a.status === "submitted");
  const avg = done.length ? done.reduce((s, a) => s + weightedScore(a.scores, RUBRIC), 0) / done.length : 0;
  const next = rows.find((a) => a.status === "in_progress") ?? rows.find((a) => a.status === "not_started");
  const list = useMemo(() => rows.filter((a) => filter === "all" || a.status === filter), [rows, filter]);
  const normReady = done.length >= 3;

  useHotkeys({
    j: () => setSel((s) => Math.min(list.length - 1, s + 1)),
    k: () => setSel((s) => Math.max(0, s - 1)),
    Enter: () => list[sel] && router.push(`/judging/${list[sel].projectId}`),
  }, [list, sel]);

  const count = (s: AssignmentStatus) => rows.filter((a) => a.status === s).length;

  return (
    <>
      <Greeting name={user.name} sub={`Judge command center · ${judgeId}`} />

      <section className="relative grid overflow-hidden rounded-md border border-line bg-surface/70 lg:grid-cols-[1.2fr_1fr]">
        <div className="border-b border-line p-5 md:p-8 lg:border-b-0 lg:border-r">
          <p className="label">Progress</p>
          <p className="mt-3 text-[clamp(3rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.05em]">
            <Counter value={done.length} /><span className="text-muted">/{rows.length}</span>
          </p>
          <p className="label mt-2">Projects reviewed</p>
          <Meter value={(done.length / Math.max(1, rows.length)) * 100} className="mt-6" label="Judging progress" />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {next ? (
              <Link href={`/judging/${next.projectId}`} className={buttonClass("primary", "lg")}>
                <Play className="size-3.5" />{next.status === "in_progress" ? "Resume session" : "Start next project"}
              </Link>
            ) : (
              <Badge tone="ok" dot>Queue complete</Badge>
            )}
            <span className="hidden items-center gap-1.5 font-mono text-[10.5px] text-muted sm:flex"><Kbd>J</Kbd><Kbd>K</Kbd>move · <Kbd>↵</Kbd>open</span>
          </div>
        </div>
        <dl className="grid grid-cols-2">
          {[
            { k: "Assigned", v: <Counter value={rows.length} /> },
            { k: "Completed", v: <Counter value={done.length} /> },
            { k: "Remaining", v: <Counter value={rows.length - done.length} /> },
            { k: "Average score", v: <Counter value={avg} decimals={1} /> },
          ].map((m, i) => (
            <div key={m.k} className={cn("border-line p-5", i % 2 === 0 && "border-r", i < 2 && "border-b")}>
              <dt className="label">{m.k}</dt>
              <dd className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{m.v}</dd>
            </div>
          ))}
          <div className="col-span-2 flex items-center justify-between border-t border-line p-5">
            <dt className="label">Normalization status</dt>
            <dd><Badge tone={normReady ? "ok" : "warn"} dot>{normReady ? "Ready" : `Needs ${3 - done.length} more`}</Badge></dd>
          </div>
        </dl>
      </section>

      <Panel className="mt-6" bodyClassName="p-0" title="Project queue" meta="ROLLING REVIEW · SUBMITTED PROJECTS ONLY">
        <Tabs size="sm" className="px-2" value={filter} onChange={(f) => { setFilter(f); setSel(0); }}
          tabs={[
            { id: "all", label: "All", count: rows.length },
            { id: "not_started", label: "Not started", count: count("not_started") },
            { id: "in_progress", label: "In progress", count: count("in_progress") },
            { id: "submitted", label: "Submitted", count: count("submitted") },
            { id: "flagged", label: "Flagged", count: count("flagged") },
          ]} />
        {list.length === 0 ? (
          <EmptyState className="m-4" code="QUEUE · 0" title="Nothing here" body="No projects in this state. Switch tabs to see the rest of your queue." />
        ) : (
          <ol role="listbox" aria-label="Assigned projects" aria-activedescendant={`q-${list[sel]?.projectId}`}>
            {list.map((a, i) => {
              const p = projectById(a.projectId)!;
              const meta = STATUS_META[a.status];
              return (
                <li key={a.projectId} id={`q-${a.projectId}`} role="option" aria-selected={i === sel}>
                  <Link href={`/judging/${p.id}`} onMouseEnter={() => setSel(i)}
                    className={cn("relative grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-line px-4 py-3.5 transition-colors last:border-0 md:grid-cols-[40px_110px_1fr_160px_120px_70px_24px]",
                      i === sel ? "bg-white/[0.04]" : "hover:bg-white/[0.02]")}>
                    {i === sel && <motion.span layoutId="queue-sel" className="absolute inset-y-0 left-0 w-[2px] bg-accent" />}
                    <span className="font-mono text-[11px] text-muted">{pad(i + 1, 2)}</span>
                    <span className="hidden font-mono text-[11px] text-fg-2 md:block">{p.code}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-medium">{p.name}</span>
                      <span className="block truncate text-[12px] text-muted md:hidden">{teamById(p.teamId).name} · <Badge tone={meta.tone} className="ml-1">{meta.label}</Badge></span>
                      <span className="hidden truncate text-[12px] text-muted md:block">{teamById(p.teamId).name}</span>
                    </span>
                    <span className="hidden truncate font-mono text-[11px] text-muted md:block">{trackById(p.trackId).name}</span>
                    <span className="hidden md:block"><Badge tone={meta.tone} dot>{meta.label}</Badge></span>
                    <span className="text-right font-mono text-[13px] tabular text-fg">{a.status === "submitted" ? weightedScore(a.scores, RUBRIC).toFixed(2) : "—"}</span>
                    <ArrowRight className="hidden size-4 text-muted md:block" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </>
  );
}

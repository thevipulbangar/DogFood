"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, FileEdit, Flag, ShieldAlert, Users } from "lucide-react";
import {
  ASSIGNMENTS, AUDIT, EVENT, JUDGES, PROJECTS, RUBRIC, SUBMISSION_TIMELINE, SUBMITTED, TEAMS,
  judgeStats, projectById, teamById,
} from "@/lib/data";
import type { User } from "@/lib/session";
import { useSimulatedLoad, useMyTeam } from "@/lib/hooks";
import { fmtUTC, hms, pad } from "@/lib/utils";
import { AreaChart, ChartFrame, HBars } from "@/components/charts/Charts";
import { Avatar, Badge, Meta, Meter, Panel, Skeleton, buttonClass } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { JoinOrCreateTeam } from "@/components/teams/JoinOrCreateTeam";
import { JudgeDashboard } from "@/components/judging/JudgeDashboard";
import { ActivityFeed, EventStatus, Greeting, MetricStrip } from "./Widgets";

export function Dashboard({ user }: { user: User }) {
  if (user.role === "participant") return <ParticipantDashboard user={user} />;
  if (user.role === "judge") return <JudgeDashboard user={user} />;
  return <OrganizerDashboard user={user} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-64" />
      <div className="grid gap-4 md:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
    </div>
  );
}

// ── Participant ───────────────────────────────────────────────

function ParticipantDashboard({ user }: { user: User }) {
  const { team, members, submission, loading, error, refresh } = useMyTeam();

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  if (!team) {
    return (
      <>
        <Greeting name={user.name} sub="Participant workspace" />
        <div className="mt-6"><JoinOrCreateTeam onDone={refresh} /></div>
      </>
    );
  }

  const checklist = [
    { k: "Project name", done: !!submission?.title },
    { k: "Description", done: (submission?.description?.length ?? 0) >= 30 },
    { k: "Repository link", done: !!submission?.repo_url },
    { k: "Demo link", done: !!submission?.demo_url },
    { k: "Track selected", done: !!submission?.track },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <>
      <Greeting name={user.name} sub="Participant workspace" />
      <EventStatus />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Your submission" meta={team.event_name} ticks
          action={submission && !submission.is_draft ? <Badge tone="ok" dot>Submitted</Badge> : <Badge tone="warn" dot>Draft</Badge>}>
          {submission ? (
            <>
              <h2 className="text-3xl font-semibold tracking-[-0.03em]">{submission.title || "Untitled project"}</h2>
              <p className="mt-1 line-clamp-2 text-[14px] text-fg-2">{submission.description}</p>
              <div className="mt-6">
                <div className="mb-2 flex justify-between font-mono text-[11px]"><span className="text-muted">COMPLETENESS</span><span className="text-fg">{done}/{checklist.length}</span></div>
                <Meter value={(done / checklist.length) * 100} label="Submission completeness" />
              </div>
              <ul className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {checklist.map((c) => (
                  <li key={c.k} className="flex items-center gap-2 text-[13px]">
                    <span className={c.done ? "size-1.5 rounded-full bg-ok" : "size-1.5 rounded-full border border-warn"} />
                    <span className={c.done ? "text-fg-2" : "text-fg"}>{c.k}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[14px] text-fg-2">Your team hasn&apos;t started a submission yet.</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/submission" className={buttonClass("primary")}><FileEdit className="size-3.5" />{submission ? "Continue editing" : "Start submission"}</Link>
            <Link href="/teams" className={buttonClass("secondary")}><Users className="size-3.5" />Team</Link>
          </div>
        </Panel>

        <Panel title="Team" meta={team.name.toUpperCase()}>
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar initials={m.name.split(" ").map((s) => s[0]).join("")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{m.name}</span>
                  <span className="font-mono text-[10.5px] text-muted">{m.email}</span>
                </span>
                {m.id === team.created_by && <Badge tone="accent">Captain</Badge>}
              </li>
            ))}
          </ul>
          <dl className="mt-5 border-t border-line pt-3">
            <Meta k="Deadline" v={fmtUTC(team.submission_deadline, "time")} />
            <Meta k="Invite code" v={team.invite_code} />
          </dl>
        </Panel>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div><p className="label">From the gallery</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Recently submitted</h2></div>
          <Link href="/projects" className="label flex items-center gap-1 hover:text-fg">All projects <ArrowRight className="size-3" /></Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...SUBMITTED].sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!)).slice(0, 3).map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
      </section>
    </>
  );
}

// ── Organizer / Admin ─────────────────────────────────────────

function OrganizerDashboard({ user }: { user: User }) {
  const loading = useSimulatedLoad();
  if (loading) return <DashboardSkeleton />;
  const judgedPct = (ASSIGNMENTS.filter((a) => a.status === "submitted").length / ASSIGNMENTS.length) * 100;
  const flagged = ASSIGNMENTS.filter((a) => a.status === "flagged");
  const drafts = PROJECTS.filter((p) => p.status === "draft");
  const abuse = AUDIT.filter((e) => e.action === "VOTE_REJECTED_DUPLICATE" || e.action === "RATE_LIMIT_TRIGGERED");

  return (
    <>
      <Greeting name={user.name} sub="Event control center" />
      <EventStatus />

      <div className="mt-6">
        <MetricStrip items={[
          { k: "Projects", v: PROJECTS.length, delta: `${drafts.length} in draft`, href: "/projects" },
          { k: "Teams", v: TEAMS.length, delta: `${TEAMS.reduce((s, t) => s + t.members.length, 0)} participants`, href: "/teams" },
          { k: "Judges", v: JUDGES.length, delta: `${ASSIGNMENTS.length} assignments`, href: "/judging" },
          { k: "Submissions", v: SUBMITTED.length, delta: `${Math.round((SUBMITTED.length / PROJECTS.length) * 100)}% of projects` },
          { k: "Judged", v: judgedPct, suffix: "%", delta: "normalization pending", href: "/judging" },
        ]} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ChartFrame title="Submission timeline" meta="Cumulative · since kickoff">
          <AreaChart data={SUBMISSION_TIMELINE} height={220} caption="Cumulative submissions by 6-hour window" />
        </ChartFrame>
        <ChartFrame title="Judge completion" meta={`${JUDGES.length} judges`}>
          <HBars caption="Completed assignments per judge" max={100} format={(v) => `${Math.round(v)}%`}
            data={JUDGES.map((j) => { const s = judgeStats(j.id); return { label: j.name, sub: j.id, value: s.assigned ? (s.completed / s.assigned) * 100 : 0 }; })
              .sort((a, b) => b.value - a.value).slice(0, 6)} />
        </ChartFrame>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Live activity" meta="AUDIT STREAM" action={<Link href="/audit" className="label flex items-center gap-1 hover:text-fg">Open ledger <ArrowRight className="size-3" /></Link>} bodyClassName="px-4 py-1">
          <ActivityFeed limit={9} />
        </Panel>

        <Panel title="Needs attention" meta={`${flagged.length + drafts.length + abuse.length} ITEMS`} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {flagged.map((a) => (
              <li key={`${a.judgeId}${a.projectId}`} className="flex items-start gap-3 p-4">
                <Flag className="mt-0.5 size-4 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]">Score flagged for review</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{a.judgeId} · PROJECT_{pad(a.projectId)}</p>
                </div>
                <Link href={`/projects/${a.projectId}`} className={buttonClass("ghost", "sm")}>Review</Link>
              </li>
            ))}
            {drafts.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-4">
                <Clock className="mt-0.5 size-4 shrink-0 text-warn" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]"><span className="font-medium">{p.name}</span> is still a draft</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{teamById(p.teamId).name.toUpperCase()} · LOCKS {fmtUTC(EVENT.deadline, "time")}</p>
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3 p-4">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px]">{abuse.length} voting anomalies blocked</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">DUPLICATES + RATE LIMITS · LAST 24H</p>
              </div>
              <Link href="/voting" className={buttonClass("ghost", "sm")}>Inspect</Link>
            </li>
          </ul>
        </Panel>
      </div>

      {user.role === "admin" && (
        <Panel title="System" meta="LOCAL INSTANCE" className="mt-6">
          <dl className="grid gap-x-10 sm:grid-cols-2 xl:grid-cols-4">
            <Meta k="Instance" v={EVENT.instance} />
            <Meta k="Version" v={`${EVENT.version} · ${EVENT.build}`} />
            <Meta k="Database" v="SQLite · 18.4 MB" />
            <Meta k="Last backup" v="04:00 UTC · OK" />
            <Meta k="API p95" v="11 ms" />
            <Meta k="Webhooks" v="3 endpoints · 100%" />
            <Meta k="Rubric" v={`${RUBRIC.length} criteria · locked`} />
            <Meta k="Network" v={<span className="text-ok">Not required</span>} />
          </dl>
          <p className="mt-4 flex items-center gap-2 font-mono text-[11px] text-muted"><AlertTriangle className="size-3.5" />No external services configured. All data resides on this host.</p>
        </Panel>
      )}
    </>
  );
}

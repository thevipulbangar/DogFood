"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, FileEdit, Users } from "lucide-react";
import type { User } from "@/lib/session";
import { useMyTeam } from "@/lib/hooks";
import { api, type EventItem, type GalleryItem, type TeamWithDetail } from "@/lib/api";
import { fmtUTC } from "@/lib/utils";
import { Avatar, Badge, Meta, Meter, Panel, Skeleton, buttonClass } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { JoinOrCreateTeam } from "@/components/teams/JoinOrCreateTeam";
import { RealJudgeDashboard } from "@/components/judging/RealJudgeDashboard";
import { EventStatus, Greeting, MetricStrip } from "./Widgets";

export function Dashboard({ user }: { user: User }) {
  if (user.role === "participant") return <ParticipantDashboard user={user} />;
  if (user.role === "judge") return <RealJudgeDashboard user={user} />;
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
  const [recent, setRecent] = useState<GalleryItem[] | null>(null);

  useEffect(() => {
    api.getGallery().then((rows) => setRecent(rows.slice(0, 3))).catch(() => setRecent([]));
  }, []);

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
    { k: "Track selected", done: (team.event_tracks?.length ?? 0) === 0 || !!submission?.track },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <>
      <Greeting name={user.name} sub="Participant workspace" />
      <div className="mt-6"><EventStatus deadline={team.submission_deadline} /></div>

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

      {recent && recent.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="label">From the gallery</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Recently submitted</h2></div>
            <Link href="/gallery" className="label flex items-center gap-1 hover:text-fg">All projects <ArrowRight className="size-3" /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((p) => (
              <Link key={p.id} href={`/gallery/${p.id}`}>
                <Panel title={p.title || "Untitled project"} className="h-full transition-colors hover:border-accent/50">
                  <p className="line-clamp-2 text-[13px] text-fg-2">{p.description}</p>
                  <p className="mt-3 font-mono text-[11px] text-muted">{p.team_name}</p>
                </Panel>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ── Organizer / Admin ─────────────────────────────────────────

function OrganizerDashboard({ user }: { user: User }) {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [teams, setTeams] = useState<TeamWithDetail[] | null>(null);
  const [error, setError] = useState<string>();

  const load = () => {
    setError(undefined);
    Promise.all([api.getEvents(), api.getTeams()])
      .then(([e, t]) => { setEvents(e); setTeams(t); })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <ErrorState onRetry={load} />;
  if (events === null || teams === null) return <DashboardSkeleton />;

  const participants = teams.reduce((s, t) => s + t.members.length, 0);
  const submitted = teams.filter((t) => t.submission && !t.submission.is_draft).length;
  const drafting = teams.filter((t) => t.submission?.is_draft).length;
  const notStarted = teams.filter((t) => !t.submission).length;
  const nextDeadline = events
    .map((e) => e.submission_deadline)
    .filter(Boolean)
    .sort()[0];

  return (
    <>
      <Greeting name={user.name} sub="Event control center" />
      {nextDeadline && <div className="mt-6"><EventStatus deadline={nextDeadline} title="Next submission deadline in" /></div>}

      <div className="mt-6">
        <MetricStrip items={[
          { k: "Events", v: events.length, href: "/admin" },
          { k: "Teams", v: teams.length, href: "/teams" },
          { k: "Participants", v: participants },
          { k: "Submitted", v: submitted, delta: `${drafting} draft · ${notStarted} not started`, href: "/gallery" },
        ]} />
        <p className="mt-3 font-mono text-[10.5px] text-muted">Judging progress: <Link href="/judging" className="underline underline-offset-4 hover:text-fg">see live status →</Link></p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Events" meta={`${events.length} TOTAL`} action={<Link href="/admin" className="label flex items-center gap-1 hover:text-fg">Manage <ArrowRight className="size-3" /></Link>} bodyClassName="p-0">
          {events.length === 0 ? (
            <p className="p-4 text-[13.5px] text-fg-2">No events yet. Create one from Administration.</p>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{e.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">DEADLINE {fmtUTC(e.submission_deadline, "time")}{e.tracks.length > 0 ? ` · ${e.tracks.length} TRACKS` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Needs attention" meta={`${notStarted + drafting} ITEMS`} bodyClassName="p-0">
          {notStarted + drafting === 0 ? (
            <p className="p-4 text-[13.5px] text-fg-2">Every team has a submitted project.</p>
          ) : (
            <ul className="divide-y divide-line">
              {teams.filter((t) => t.submission?.is_draft).map((t) => (
                <li key={t.id} className="flex items-start gap-3 p-4">
                  <Clock className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px]"><span className="font-medium">{t.name}</span> has a draft submission</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">{t.event_name.toUpperCase()} · LOCKS {fmtUTC(t.submission_deadline, "time")}</p>
                  </div>
                </li>
              ))}
              {teams.filter((t) => !t.submission).map((t) => (
                <li key={t.id} className="flex items-start gap-3 p-4">
                  <Clock className="mt-0.5 size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px]"><span className="font-medium">{t.name}</span> hasn&apos;t started a submission</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">{t.event_name.toUpperCase()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {user.role === "admin" && (
        <Panel title="System" meta="LOCAL INSTANCE" className="mt-6">
          <dl className="grid gap-x-10 sm:grid-cols-2 xl:grid-cols-3">
            <Meta k="Deployment" v="Self-hosted (Docker Compose)" />
            <Meta k="Network" v={<span className="text-ok">Not required</span>} />
            <Meta k="Manage accounts" v={<Link href="/admin" className="underline underline-offset-4 hover:text-accent">Administration →</Link>} />
          </dl>
        </Panel>
      )}
    </>
  );
}

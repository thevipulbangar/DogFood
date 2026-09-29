"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileEdit, Search, Check } from "lucide-react";
import { TEAMS, projectById } from "@/lib/data";
import { cn, fmtUTC, hms } from "@/lib/utils";
import { useNow, useMyTeam } from "@/lib/hooks";
import type { User } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, Badge, Button, Meta, Panel, StatusDot, Skeleton, buttonClass, fieldClass } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { JoinOrCreateTeam } from "./JoinOrCreateTeam";

// Organizer's all-teams table below still runs on mock data (not wired to
// the backend yet); this only bounds that table's display copy.
const MAX_TEAM = 5;

export function TeamWorkspace({ user }: { user: User }) {
  const toast = useToast();
  const now = useNow();
  const { team, members, submission, loading, error, refresh } = useMyTeam();

  const link = team ? `${typeof window !== "undefined" ? window.location.origin : ""}/teams?code=${team.invite_code}` : "";
  const left = team && now ? Date.parse(team.submission_deadline) - now : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(team!.invite_code);
      toast({ tone: "ok", title: "Invite code copied", body: team!.invite_code });
    } catch {
      toast({ tone: "warn", title: "Clipboard unavailable", body: "Select the code and copy it manually." });
    }
  };

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;
  }
  if (error) return <ErrorState onRetry={refresh} />;
  if (!team) {
    return (
      <>
        <PageHeader crumbs={[{ label: "Team" }]} title="Join or start a team" meta={<span>You're not on a team yet</span>} />
        <JoinOrCreateTeam onDone={refresh} />
      </>
    );
  }

  return (
    <>
      <PageHeader crumbs={[{ label: "Team" }]} eyebrow={<><StatusDot tone="ok" />Team workspace</>} title={team.name.toUpperCase()}
        meta={<><span>{members.length} member{members.length === 1 ? "" : "s"}</span><span>{team.event_name}</span><span>Created {fmtUTC(team.created_at)}</span></>} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Members" meta={`${members.length}`} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar initials={m.name.split(" ").map((s) => s[0]).join("")} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[14.5px]">{m.name}{m.id === user.id && <span className="font-mono text-[10px] text-muted">(YOU)</span>}</span>
                  <span className="font-mono text-[10.5px] text-muted">{m.email}</span>
                </span>
                {m.id === team.created_by && <Badge tone="accent">Captain</Badge>}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel title="Invite code">
            <label htmlFor="invite" className="sr-only">Invite code</label>
            <div className="flex gap-2">
              <input id="invite" readOnly value={team.invite_code} onFocus={(e) => e.currentTarget.select()} className={cn(fieldClass, "h-10 font-mono text-[13px]")} />
              <Button variant="primary" onClick={copy} className="h-10" aria-label="Copy invite code">
                <Copy className="size-3.5" /><span className="hidden sm:inline">Copy</span>
              </Button>
            </div>
            <p className="mt-3 font-mono text-[10.5px] text-muted">Share this code — new members use it on the Teams page to join.</p>
          </Panel>

          <Panel title="Submission" action={submission?.is_draft === false ? <Badge tone="ok" dot>Submitted</Badge> : <Badge tone="warn" dot>Draft</Badge>}>
            {submission ? (
              <>
                <p className="text-2xl font-semibold tracking-tight">{submission.title || "Untitled project"}</p>
                <p className="mt-1 line-clamp-2 text-[13.5px] text-fg-2">{submission.description}</p>
              </>
            ) : (
              <p className="text-[13.5px] text-fg-2">No submission started yet.</p>
            )}
            <dl className="mt-4">
              <Meta k="Deadline" v={fmtUTC(team.submission_deadline, "time")} />
              <Meta k="Time left" v={<span className="tabular">{left == null ? "--:--:--" : left > 0 ? hms(left) : "CLOSED"}</span>} />
            </dl>
            <Link href="/submission" className={buttonClass("secondary", "md", "mt-4 w-full")}><FileEdit className="size-3.5" />Open submission builder</Link>
          </Panel>
        </div>
      </div>
    </>
  );
}

export function TeamsTable() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const rows = useMemo(() => TEAMS.filter((t) => `${t.name} ${t.members.map((m) => m.name).join(" ")} ${projectById(t.projectId)?.name}`.toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <>
      <PageHeader eyebrow="T1 · Teams" title="Teams" meta={<><span>{TEAMS.length} teams</span><span>{TEAMS.reduce((s, t) => s + t.members.length, 0)} participants</span><span>Max {MAX_TEAM} / team</span></>} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams, members, projects…" aria-label="Search teams" className={cn(fieldClass, "h-9 pl-9")} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No teams found" body="No team, member or project matches that search." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[760px] text-left">
            <caption className="sr-only">Teams</caption>
            <thead><tr className="border-b border-line bg-white/[0.02]">
              {["Team", "Members", "Project", "Status", "Created"].map((h) => <th key={h} scope="col" className="label px-4 py-3 font-normal">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((t) => {
                const p = projectById(t.projectId)!;
                return (
                  <tr key={t.id} tabIndex={0} onClick={() => router.push(`/projects/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/projects/${p.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-white/[0.025] focus-visible:bg-white/[0.04]">
                    <th scope="row" className="px-4 py-3 font-normal"><span className="text-[14px] text-fg">{t.name}</span><span className="block font-mono text-[10.5px] text-muted">{t.id.toUpperCase()} · INVITE {t.inviteCode}</span></th>
                    <td className="px-4 py-3"><div className="flex -space-x-1.5">{t.members.map((m) => <Avatar key={m.handle} initials={m.initials} size={26} className="ring-2 ring-bg" />)}</div></td>
                    <td className="px-4 py-3 text-[13.5px]">{p.name}<span className="ml-2 font-mono text-[10.5px] text-muted">{p.code}</span></td>
                    <td className="px-4 py-3">{p.status === "submitted" ? <Badge tone="ok" dot>Submitted</Badge> : <Badge tone="warn" dot>Draft</Badge>}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-muted">{fmtUTC(t.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

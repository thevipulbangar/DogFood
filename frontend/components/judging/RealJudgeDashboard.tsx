"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { api, type JudgeAssignment } from "@/lib/api";
import type { User } from "@/lib/session";
import { Badge, Meter, Panel, Skeleton, buttonClass } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Greeting } from "@/components/dashboard/Widgets";

/**
 * The real, backend-backed judge dashboard (GET /api/judging/my-assignments).
 * A simpler replacement for the mock-data JudgeDashboard while T2 is new —
 * see ARCHITECTURE.md for why the fancier one is still around unused.
 */
export function RealJudgeDashboard({ user }: { user: User }) {
  const [rows, setRows] = useState<JudgeAssignment[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.getMyAssignments().then(setRows).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <ErrorState onRetry={() => setError(undefined)} />;
  if (rows === null) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;

  const done = rows.filter((a) => a.status === "completed");
  const next = rows.find((a) => a.status === "pending");

  return (
    <>
      <Greeting name={user.name} sub="Judge command center" />

      <section className="rounded-md border border-line bg-surface/70 p-5 md:p-8">
        <p className="label">Progress</p>
        <p className="mt-3 text-[clamp(3rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.05em]">
          {done.length}<span className="text-muted">/{rows.length}</span>
        </p>
        <p className="label mt-2">Projects reviewed</p>
        <Meter value={(done.length / Math.max(1, rows.length)) * 100} className="mt-6" label="Judging progress" />
        <div className="mt-6">
          {next ? (
            <Link href={`/judging/${next.id}`} className={buttonClass("primary", "lg")}>
              <Play className="size-3.5" />Start next project
            </Link>
          ) : rows.length > 0 ? (
            <Badge tone="ok" dot>Queue complete</Badge>
          ) : null}
        </div>
      </section>

      <Panel className="mt-6" bodyClassName="p-0" title="Assigned projects" meta={`${rows.length} TOTAL`}>
        {rows.length === 0 ? (
          <EmptyState className="m-4" code="QUEUE · 0" title="Nothing assigned yet" body="The organizer hasn't run judge assignment for this event yet." />
        ) : (
          <ol>
            {rows.map((a) => (
              <li key={a.id} className="border-b border-line last:border-0">
                <Link href={`/judging/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{a.title || "Untitled project"}</span>
                    <span className="block truncate text-[12px] text-muted">{a.track}</span>
                  </span>
                  <Badge tone={a.status === "completed" ? "ok" : "warn"} dot>{a.status === "completed" ? "Submitted" : "Not started"}</Badge>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}

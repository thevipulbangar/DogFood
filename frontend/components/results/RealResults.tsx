"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { api, type ResultRow, type VotingResultRow } from "@/lib/api";
import type { User } from "@/lib/session";
import { Badge, Button, Panel, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type EventRow = { id: number; name: string };

/**
 * Real results page: judging results (GET /api/judging/results, staff-only
 * per role isolation) plus the community vote count (GET /api/voting/results,
 * hidden until an organizer publishes it — T3's "hidden results during
 * voting" requirement).
 */
export function RealResults({ user }: { user: User }) {
  const toast = useToast();
  const staff = user.role === "organizer" || user.role === "admin";
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [judging, setJudging] = useState<ResultRow[] | null>(null);
  const [voting, setVoting] = useState<{ published: boolean; results: VotingResultRow[] } | null>(null);
  const [votingError, setVotingError] = useState<string>();
  const [error, setError] = useState<string>();
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api.getEvents().then((rows) => { setEvents(rows); if (rows.length > 0) setEventId(rows[0].id); }).catch((err: Error) => setError(err.message));
  }, []);

  const load = (id: number) => {
    setVotingError(undefined);
    if (staff) api.getResults(id).then(setJudging).catch((err: Error) => setError(err.message));
    api.getVotingResults(id).then(setVoting).catch((err: Error) => setVotingError(err.message));
  };
  useEffect(() => { if (eventId !== null) load(eventId); }, [eventId]);

  const togglePublish = async () => {
    if (eventId === null || !voting) return;
    setPublishing(true);
    try {
      await api.publishResults(eventId, !voting.published);
      load(eventId);
      toast({ tone: "ok", title: voting.published ? "Results unpublished" : "Results published" });
    } catch (err) {
      toast({ tone: "warn", title: "Couldn't update", body: err instanceof Error ? err.message : undefined });
    } finally {
      setPublishing(false);
    }
  };

  if (error) return <ErrorState onRetry={() => setError(undefined)} />;
  if (events === null) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;
  if (events.length === 0) return <EmptyState code="0 EVENTS" title="No events yet" body="Results appear once an event has scores or votes." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-sm text-fg-2">Judging scores {staff ? "" : "(staff only) "}and community vote counts.</p>
      </div>

      {staff && (
        <Panel title="Judging results" meta="NORMALIZED" bodyClassName="overflow-x-auto p-0">
          {judging === null ? (
            <div className="p-6"><Skeleton className="h-40" /></div>
          ) : judging.length === 0 ? (
            <EmptyState code="0 RESULTS" title="No scores yet" body="Assign judges and wait for scores." />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-3 font-medium">Submission</th><th className="px-4 py-3 font-medium">Team</th><th className="px-4 py-3 font-medium">Judges</th><th className="px-4 py-3 font-medium">Normalized avg</th></tr></thead>
              <tbody>
                {judging.map((r) => (
                  <tr key={r.submission_id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">{r.title}</td>
                    <td className="px-4 py-3 text-fg-2">{r.team_name}</td>
                    <td className="px-4 py-3 text-fg-2">{r.judges_completed}{!r.fully_normalized && <Badge tone="warn" className="ml-2">partial data</Badge>}</td>
                    <td className="px-4 py-3 font-mono">{r.normalized_avg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      <Panel
        title="Community vote"
        meta={voting?.published ? "PUBLISHED" : "HIDDEN"}
        action={staff && voting ? <Button onClick={togglePublish} disabled={publishing}>{voting.published ? "Unpublish" : "Publish results"}</Button> : undefined}
        bodyClassName="overflow-x-auto p-0"
      >
        {votingError ? (
          <div className="p-6"><EmptyState code="HIDDEN" title="Results not published yet" body={votingError} /></div>
        ) : voting === null ? (
          <div className="p-6"><Skeleton className="h-40" /></div>
        ) : voting.results.length === 0 ? (
          <EmptyState code="0 VOTES" title="No votes yet" body="Cast votes on the Voting page." />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-3 font-medium">Rank</th><th className="px-4 py-3 font-medium">Submission</th><th className="px-4 py-3 font-medium">Team</th><th className="px-4 py-3 font-medium">Votes</th></tr></thead>
            <tbody>
              {voting.results.map((r, i) => (
                <tr key={r.submission_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-fg-2">{i === 0 && r.vote_count > 0 ? <Trophy size={14} className="inline text-accent" /> : `#${i + 1}`}</td>
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 text-fg-2">{r.team_name}</td>
                  <td className="px-4 py-3 font-mono">{r.vote_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

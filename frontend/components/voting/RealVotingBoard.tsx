"use client";

import { useEffect, useState } from "react";
import { MessageSquare, ThumbsUp } from "lucide-react";
import { api, type VotingFeedItem, type Comment } from "@/lib/api";
import type { User } from "@/lib/session";
import { Badge, Button, Panel, Skeleton, fieldClass } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type EventRow = { id: number; name: string };

/**
 * Real, backend-backed community voting (T3). Participant-only (judges and
 * staff don't vote — see JUDGING.md / THREAT_MODEL.md for why), randomized
 * order on every load (server-side ORDER BY random()), one vote per
 * submission enforced by a database unique constraint, and no vote counts
 * shown here — results stay hidden until an organizer publishes them
 * (see /results).
 */
export function RealVotingBoard({ user }: { user: User }) {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [feed, setFeed] = useState<VotingFeedItem[] | null>(null);
  const [votingOpen, setVotingOpen] = useState(true);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api.getEvents().then((rows) => { setEvents(rows); if (rows.length > 0) setEventId(rows[0].id); }).catch((err: Error) => setError(err.message));
  }, []);

  const load = (id: number) => {
    setFeed(null);
    api.getVotingFeed(id)
      .then((res) => { setVotingOpen(res.voting_open); setFeed(res.projects); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(() => { if (eventId !== null) load(eventId); }, [eventId]);

  const vote = async (submissionId: number) => {
    try {
      await api.castVote(submissionId);
      setFeed((rows) => rows?.map((r) => (r.id === submissionId ? { ...r, has_voted: true } : r)) ?? rows);
      toast({ tone: "ok", title: "Vote cast" });
    } catch (err) {
      toast({ tone: "warn", title: "Couldn't vote", body: err instanceof Error ? err.message : undefined });
    }
  };

  if (user.role !== "participant") {
    return (
      <EmptyState
        code="STAFF VIEW"
        title="Voting is participant-only"
        body="Judges and organizers score through the judging rubric instead — voting stays isolated to keep the two signals independent. See /results for published community vote counts."
      />
    );
  }

  if (error) return <ErrorState onRetry={() => setError(undefined)} />;
  if (events === null) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;
  if (events.length === 0) return <EmptyState code="0 EVENTS" title="No events yet" body="Voting opens once an event exists." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community voting</h1>
        <p className="text-sm text-fg-2">One vote per project. Order is randomized — no project is favored by list position. You can&apos;t vote for your own team.</p>
      </div>

      {feed === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[200px]" />)}</div>
      ) : !votingOpen ? (
        <EmptyState code="VOTING CLOSED" title="Voting is closed for this event" body="An organizer has closed voting. Check back if it reopens, or see the Results page for published outcomes." />
      ) : feed.length === 0 ? (
        <EmptyState code="0 PROJECTS" title="Nothing to vote on yet" body="Submitted projects (not your own team's) will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {feed.map((p) => (
            <Panel key={p.id} title={p.title || "Untitled project"} action={p.track ? <Badge tone="accent">{p.track}</Badge> : undefined}>
              <p className="line-clamp-3 text-[13.5px] text-fg-2">{p.description}</p>
              <p className="mt-3 font-mono text-[11px] text-muted">{p.team_name}</p>
              <div className="mt-4 flex items-center gap-2">
                <Button onClick={() => vote(p.id)} disabled={p.has_voted}>
                  <ThumbsUp size={14} className="mr-1.5" /> {p.has_voted ? "Voted" : "Vote"}
                </Button>
                <button className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2 hover:text-fg" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <MessageSquare size={14} /> Comments
                </button>
              </div>
              {open === p.id && <CommentsThread submissionId={p.id} />}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentsThread({ submissionId }: { submissionId: number }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = () => { api.getComments(submissionId).then(setComments).catch(() => setComments([])); };
  useEffect(load, [submissionId]);

  const post = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await api.postComment(submissionId, draft.trim());
      setDraft("");
      load();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-4 border-t border-line pt-3">
      {comments === null ? (
        <Skeleton className="h-10" />
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-muted">No comments yet.</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="text-[12.5px]">
              <span className="font-medium text-fg-2">{c.author_name}</span>{" "}
              <span className="text-muted">· {new Date(c.created_at).toLocaleString()}</span>
              <p className="text-fg-2">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" className={fieldClass + " h-8 flex-1 text-[12.5px]"} onKeyDown={(e) => e.key === "Enter" && post()} />
        <Button onClick={post} disabled={posting || !draft.trim()}>Post</Button>
      </div>
    </div>
  );
}

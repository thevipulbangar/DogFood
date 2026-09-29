"use client";

import { useEffect, useState } from "react";
import { Download, Shuffle } from "lucide-react";
import { api, type ResultRow } from "@/lib/api";
import { Badge, Button, Panel, Skeleton, buttonClass } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type EventRow = { id: number; name: string };

/**
 * The real, backend-backed organizer/admin judging console:
 *   - trigger round-robin judge assignment (POST /api/judging/assign)
 *   - view normalized results (GET /api/judging/results)
 *   - export CSVs (GET /api/judging/export.csv)
 * A simpler replacement for the mock-data JudgingOps while T2 is new —
 * see ARCHITECTURE.md.
 */
export function RealJudgingOps() {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [error, setError] = useState<string>();
  const [assigning, setAssigning] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    api
      .getEvents()
      .then((rows: EventRow[]) => {
        setEvents(rows);
        if (rows.length > 0) setEventId(rows[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const loadResults = (id: number) => {
    setLoadingResults(true);
    api
      .getResults(id)
      .then(setResults)
      .catch((err: Error) => toast({ tone: "warn", title: "Couldn't load results", body: err.message }))
      .finally(() => setLoadingResults(false));
  };

  useEffect(() => {
    if (eventId !== null) loadResults(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const runAssignment = async () => {
    if (eventId === null) return;
    setAssigning(true);
    try {
      const res = await api.assignJudges(eventId, 3);
      toast({ tone: "ok", title: "Judges assigned", body: `${res.assignments_created ?? 0} new assignment(s) created.` });
      loadResults(eventId);
    } catch (err) {
      toast({ tone: "warn", title: "Assignment failed", body: err instanceof Error ? err.message : undefined });
    } finally {
      setAssigning(false);
    }
  };

  const exportCsv = async (type: "results" | "assignments" | "scores") => {
    if (eventId === null) return;
    try {
      await api.downloadCsv(eventId, type);
    } catch (err) {
      toast({ tone: "warn", title: "Export failed", body: err instanceof Error ? err.message : undefined });
    }
  };

  if (error) return <ErrorState onRetry={() => setError(undefined)} />;
  if (events === null) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;
  if (events.length === 0) return <EmptyState code="0 EVENTS" title="No events yet" body="Create an event before running judging." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Judging</h1>
          <p className="text-sm text-white/60">Round-robin assignment, live normalized results, CSV export.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runAssignment} disabled={assigning}>
            <Shuffle size={16} className="mr-1.5" /> {assigning ? "Assigning…" : "Assign judges"}
          </Button>
          <button className={buttonClass("secondary", "md")} onClick={() => exportCsv("results")}>
            <Download size={16} className="mr-1.5" /> Results CSV
          </button>
          <button className={buttonClass("secondary", "md")} onClick={() => exportCsv("assignments")}>
            <Download size={16} className="mr-1.5" /> Assignments CSV
          </button>
          <button className={buttonClass("secondary", "md")} onClick={() => exportCsv("scores")}>
            <Download size={16} className="mr-1.5" /> Scores CSV
          </button>
        </div>
      </div>

      <Panel className="overflow-x-auto p-0">
        {loadingResults || results === null ? (
          <div className="p-6"><Skeleton className="h-48" /></div>
        ) : results.length === 0 ? (
          <EmptyState code="0 RESULTS" title="No results yet" body="Assign judges and wait for scores to come in." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/50">
                <th className="px-4 py-3 font-medium">Submission</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Judges completed</th>
                <th className="px-4 py-3 font-medium">Raw avg</th>
                <th className="px-4 py-3 font-medium">Normalized avg</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {results
                .slice()
                .sort((a, b) => b.normalized_avg - a.normalized_avg)
                .map((r) => (
                  <tr key={r.submission_id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">{r.title || "Untitled"}</td>
                    <td className="px-4 py-3 text-white/70">{r.team_name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.judges_completed > 0 ? "ok" : "neutral"}>{r.judges_completed}</Badge>
                    </td>
                    <td className="px-4 py-3">{Number(r.raw_avg).toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium">{Number(r.normalized_avg).toFixed(3)}</td>
                    <td className="px-4 py-3">
                      {!r.fully_normalized && (
                        <Badge tone="warn">partial data</Badge>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

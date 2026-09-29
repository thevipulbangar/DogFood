"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, Plus, Save, Shuffle, Trash2 } from "lucide-react";
import { api, type ResultRow, type RubricCriterion } from "@/lib/api";
import { Badge, Button, Panel, Skeleton, buttonClass, fieldClass } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type EventRow = { id: number; name: string };
type DraftCriterion = { key: string; name: string; description: string; weight: string };

let draftKeySeq = 0;
function toDraft(c: RubricCriterion): DraftCriterion {
  return { key: `existing-${c.id}`, name: c.name, description: c.description ?? "", weight: String(c.weight) };
}
function blankDraft(): DraftCriterion {
  return { key: `new-${++draftKeySeq}`, name: "", description: "", weight: "" };
}

/**
 * The rubric editor for one event (GET/POST /api/judging/rubric).
 * Saving REPLACES the whole rubric — the backend deletes and re-inserts
 * criteria, and rubric_criteria → scores cascades on delete, so replacing
 * criteria that judges already scored against deletes those scores. The
 * warning banner below says so; there's no way around it without changing
 * the backend's replace-not-patch semantics, which the T2 write-up
 * (JUDGING.md) documents deliberately for simplicity.
 */
function RubricEditor({ eventId }: { eventId: number }) {
  const toast = useToast();
  const [rows, setRows] = useState<DraftCriterion[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const load = () => {
    setRows(null);
    api
      .getRubric(eventId)
      .then((criteria) => setRows(criteria.length ? criteria.map(toDraft) : [blankDraft()]))
      .catch((err: Error) => setError(err.message));
  };
  useEffect(load, [eventId]);

  if (error) return <ErrorState onRetry={() => { setError(undefined); load(); }} />;
  if (rows === null) return <Skeleton className="h-40" />;

  const total = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  const balanced = Math.abs(total - 100) < 0.01;

  const update = (key: string, patch: Partial<DraftCriterion>) =>
    setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((rs) => rs!.filter((r) => r.key !== key));
  const add = () => setRows((rs) => [...rs!, blankDraft()]);

  const save = async () => {
    const criteria = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim(), description: r.description.trim() || undefined, weight: Number(r.weight) }));
    if (criteria.length === 0) {
      toast({ tone: "warn", title: "Add at least one criterion" });
      return;
    }
    if (!balanced) {
      toast({ tone: "warn", title: "Weights must sum to 100", body: `Currently ${total}` });
      return;
    }
    setSaving(true);
    try {
      await api.setRubric(eventId, criteria);
      toast({ tone: "ok", title: "Rubric saved" });
      load();
    } catch (err) {
      toast({ tone: "warn", title: "Couldn't save rubric", body: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Rubric" meta={`Weights ${total} / 100`} className="max-w-2xl">
      <div className="mb-4 flex items-start gap-2 rounded-sm border border-warn/30 bg-warn/[0.06] p-3 text-[12.5px] text-white/70">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
        <p>Saving replaces the entire rubric. If judges have already scored against the current criteria, removing or renaming those criteria deletes their scores.</p>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_1fr_90px_auto] items-start gap-2">
            <input className={cn(fieldClass, "h-9")} placeholder="Criterion name" value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
            <input className={cn(fieldClass, "h-9")} placeholder="Description (optional)" value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} />
            <input className={cn(fieldClass, "h-9")} type="number" min={0} step="0.5" placeholder="Weight" value={r.weight} onChange={(e) => update(r.key, { weight: e.target.value })} />
            <button type="button" aria-label="Remove criterion" className="flex h-9 w-9 items-center justify-center text-white/40 hover:text-danger" onClick={() => remove(r.key)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className={buttonClass("secondary", "sm")} onClick={add}>
          <Plus size={13} className="mr-1" /> Add criterion
        </button>
        <span className={cn("font-mono text-xs", balanced ? "text-ok" : "text-warn")}>{total} / 100</span>
        <Button className="ml-auto" onClick={save} disabled={saving}>
          <Save size={15} className="mr-1.5" /> {saving ? "Saving…" : "Save rubric"}
        </Button>
      </div>
    </Panel>
  );
}

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

      {eventId !== null && <RubricEditor eventId={eventId} />}

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

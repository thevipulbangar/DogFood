"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Send } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/session";
import { Badge, Button, Panel, Skeleton, fieldClass } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type Criterion = { id: number; name: string; description: string | null; weight: number };
type Assignment = { id: number; status: "pending" | "completed"; title: string | null; description: string | null; track: string | null; repo_url: string | null; demo_url: string | null };
type Score = { criterion_id: number; raw_score: number; notes: string | null };

/**
 * The real, backend-backed judging session (GET/POST /api/judging/assignments/:id/...).
 * A simpler replacement for the mock-data JudgingSession while T2 is new.
 */
export function RealJudgingSession({ assignmentId }: { assignmentId: number; user: User }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<{ assignment: Assignment; criteria: Criterion[]; scores: Score[] } | null>(null);
  const [error, setError] = useState<string>();
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.getAssignment(assignmentId)
      .then((d) => {
        setData(d);
        const initial: Record<number, string> = {};
        for (const s of d.scores) initial[s.criterion_id] = String(s.raw_score);
        setValues(initial);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [assignmentId]);

  if (error) return <ErrorState onRetry={() => { setError(undefined); load(); }} />;
  if (!data) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;

  const { assignment, criteria } = data;
  const locked = assignment.status === "completed";
  const allFilled = criteria.every((c) => values[c.id] !== undefined && values[c.id] !== "");

  const saveDraft = async () => {
    setSaving(true);
    try {
      const scores = criteria
        .filter((c) => values[c.id] !== undefined && values[c.id] !== "")
        .map((c) => ({ criterion_id: c.id, raw_score: Number(values[c.id]) }));
      if (scores.length === 0) return;
      await api.saveScores(assignmentId, scores);
      toast({ tone: "ok", title: "Draft saved" });
    } catch (err) {
      toast({ tone: "warn", title: "Could not save", body: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!allFilled) {
      toast({ tone: "warn", title: "Score every criterion first" });
      return;
    }
    setSubmitting(true);
    try {
      await saveDraft();
      await api.completeAssignment(assignmentId);
      toast({ tone: "ok", title: "Score submitted" });
      router.push("/judging");
    } catch (err) {
      toast({ tone: "warn", title: "Could not submit", body: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <p className="label">Judging session</p>
        <h1 className="mt-2 text-[clamp(2.2rem,5vw,3.5rem)] font-semibold leading-[0.9] tracking-[-0.04em]">{assignment.title || "Untitled project"}</h1>
        <p className="mt-3 text-[14px] text-fg-2">{assignment.description}</p>
        <div className="mt-4 flex gap-3 font-mono text-[11px]">
          {assignment.repo_url && <a href={assignment.repo_url} target="_blank" rel="noreferrer" className="text-fg underline underline-offset-4 hover:text-accent">Repository</a>}
          {assignment.demo_url && <a href={assignment.demo_url} target="_blank" rel="noreferrer" className="text-fg underline underline-offset-4 hover:text-accent">Demo</a>}
        </div>

        {locked && (
          <div className="mt-6 flex items-start gap-4 rounded-md border border-ok/30 bg-ok/[0.05] p-5" role="status">
            <Lock className="mt-0.5 size-5 text-ok" />
            <div>
              <p className="font-mono text-[12px] tracking-[0.1em] text-ok">SCORE SUBMITTED</p>
              <p className="mt-2 text-[13px] text-muted">This assignment is locked. Scores can no longer be changed.</p>
            </div>
          </div>
        )}

        <fieldset disabled={locked} className="mt-10 space-y-6 disabled:opacity-70">
          {criteria.map((c) => (
            <Panel key={c.id} title={c.name} meta={`WEIGHT ${c.weight}%`}>
              {c.description && <p className="mb-3 text-[13px] text-muted">{c.description}</p>}
              <input
                type="number" min={0} max={10} step={0.5}
                value={values[c.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                className={cn(fieldClass, "h-11 w-32 font-mono text-[15px]")}
                placeholder="0-10"
              />
            </Panel>
          ))}
        </fieldset>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Panel title="Status" action={locked ? <Badge tone="ok" dot>Submitted</Badge> : <Badge tone="warn" dot>In progress</Badge>}>
          <ul className="space-y-2">
            {criteria.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-[13px]">
                <span className={values[c.id] ? "text-fg-2" : "text-fg"}>{c.name}</span>
                {values[c.id] ? <Check className="size-3.5 text-ok" /> : <span className="font-mono text-[10px] text-muted">TODO</span>}
              </li>
            ))}
          </ul>
        </Panel>

        {!locked && (
          <>
            <Button variant="secondary" size="lg" className="w-full" onClick={saveDraft} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button variant="primary" size="lg" className="w-full" onClick={submit} disabled={submitting || !allFilled}>
              <Send className="size-3.5" />{submitting ? "Submitting…" : "Submit score"}
            </Button>
          </>
        )}
      </aside>
    </div>
  );
}

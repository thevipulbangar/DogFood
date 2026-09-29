"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { ASSIGNMENTS, JUDGES, LEADERBOARD, RAW_SCORES, RUBRIC, judgeStats, projectById } from "@/lib/data";
import { weightedScore } from "@/lib/scoring";
import { downloadCSV, pad } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Button, Meter, Panel } from "@/components/ui/primitives";
import { ChartFrame, PairedBars } from "@/components/charts/Charts";
import { MetricStrip } from "@/components/dashboard/Widgets";
import { useToast } from "@/components/ui/Toast";

/** Organizer view of judging: coverage, per-judge bias and normalization impact. */
export function JudgingOps() {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const panelMean = RAW_SCORES.reduce((s, r) => s + r.raw, 0) / RAW_SCORES.length;
  const submitted = ASSIGNMENTS.filter((a) => a.status === "submitted").length;
  const flagged = ASSIGNMENTS.filter((a) => a.status === "flagged").length;

  const exportScores = () => {
    downloadCSV("dogfood-2026-scores.csv", ASSIGNMENTS.filter((a) => a.status === "submitted").map((a) => ({
      judge: a.judgeId, project: a.projectId, name: projectById(a.projectId)!.name,
      ...Object.fromEntries(RUBRIC.map((c) => [c.id, a.scores[c.id]])), weighted: weightedScore(a.scores, RUBRIC).toFixed(3), confidence: a.confidence, submitted_at: a.submittedAt,
    })));
    toast({ tone: "ok", title: "Scores exported", body: `dogfood-2026-scores.csv · ${submitted} rows` });
  };

  return (
    <>
      <PageHeader eyebrow="T2 · Judging operations" title="Judging" meta={<><span>{JUDGES.length} judges</span><span>{ASSIGNMENTS.length} assignments</span><span>3 judges / project</span></>}
        actions={<>
          <Button onClick={exportScores}><Download className="size-3.5" />Export CSV</Button>
          <Button variant="primary" disabled={running} onClick={() => { setRunning(true); setTimeout(() => { setRunning(false); toast({ tone: "ok", title: "Normalization complete", body: `z-score · ${RAW_SCORES.length} scores · ${JUDGES.length} judges` }); }, 900); }}>
            <RefreshCw className={running ? "size-3.5 animate-spin" : "size-3.5"} />{running ? "Running…" : "Run normalization"}
          </Button>
        </>} />

      <MetricStrip items={[
        { k: "Assignments", v: ASSIGNMENTS.length },
        { k: "Scores in", v: submitted },
        { k: "Coverage", v: (submitted / ASSIGNMENTS.length) * 100, suffix: "%" },
        { k: "Flagged", v: flagged },
        { k: "Panel mean", v: panelMean, decimals: 2 },
      ]} />

      <Panel title="Judge roster" meta="BIAS = JUDGE MEAN − PANEL MEAN" className="mt-6" bodyClassName="p-0 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <caption className="sr-only">Judge progress and scoring bias</caption>
          <thead>
            <tr className="border-b border-line text-muted">
              {["Judge", "Assigned", "Completed", "Progress", "Mean", "Bias", "Status"].map((h, i) => (
                <th key={h} scope="col" className={`label px-4 py-3 font-normal ${i > 0 && i !== 3 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {JUDGES.map((j) => {
              const s = judgeStats(j.id);
              const bias = s.completed ? s.average - panelMean : 0;
              return (
                <tr key={j.id} className="border-b border-line last:border-0 hover:bg-white/[0.02]">
                  <th scope="row" className="px-4 py-3 font-normal">
                    <span className="block text-[14px] text-fg">{j.name}</span>
                    <span className="font-mono text-[10.5px] text-muted">{j.id} · {j.title}</span>
                  </th>
                  <td className="px-4 py-3 text-right font-mono text-[13px] tabular">{s.assigned}</td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] tabular">{s.completed}</td>
                  <td className="w-40 px-4 py-3"><Meter value={(s.completed / s.assigned) * 100} tone={s.completed === s.assigned ? "ok" : "accent"} label={`${j.name} progress`} /></td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] tabular">{s.completed ? s.average.toFixed(2) : "—"}</td>
                  <td className={`px-4 py-3 text-right font-mono text-[13px] tabular ${Math.abs(bias) > 0.5 ? "text-warn" : "text-fg-2"}`}>{s.completed ? `${bias > 0 ? "+" : ""}${bias.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {s.assignments.some((a) => a.status === "flagged") ? <Badge tone="danger" dot>Flagged</Badge>
                      : s.completed === s.assigned ? <Badge tone="ok" dot>Done</Badge> : <Badge tone="warn" dot>Active</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <ChartFrame title="Normalization impact" meta="Top 12 · raw vs normalized mean" className="mt-6">
        <PairedBars caption="Raw versus normalized mean score per project" series={["Raw", "Normalized"]} domain={[5, 10]}
          data={LEADERBOARD.slice(0, 12).map((r) => ({ label: `P-${pad(r.project.id)} ${r.project.name}`, a: r.raw, b: r.normalized }))} />
        <p className="mt-4 font-mono text-[11px] text-muted">Per-judge z-scores rescaled to the panel distribution. Projects reviewed by harsher judges move up; generous panels move down.</p>
      </ChartFrame>
    </>
  );
}

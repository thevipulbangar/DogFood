"use client";

import { ASSIGNMENTS, JUDGES, LEADERBOARD, RUBRIC, SUBMISSION_TIMELINE, TRACKS, VOTING_ACTIVITY, SUBMITTED, judgeStats } from "@/lib/data";
import { pad } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { AreaChart, BarChart, ChartFrame, HBars, PairedBars } from "@/components/charts/Charts";

export function Analytics() {
  const done = ASSIGNMENTS.filter((a) => a.status === "submitted");
  // Score distribution: histogram of weighted raw scores in 0.5 buckets from 5 to 10.
  const buckets = Array.from({ length: 10 }, (_, i) => 5 + i * 0.5);
  const dist = buckets.map((b) => ({
    label: b.toFixed(1),
    value: LEADERBOARD.filter((r) => r.normalized >= b && r.normalized < b + 0.5).length,
  }));
  const criterionAvg = RUBRIC.map((c) => {
    const vals = done.map((a) => a.scores[c.id]).filter((v): v is number => v != null);
    return { label: c.name, sub: `${c.weight}%`, value: vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length) };
  });
  const byTrack = TRACKS.map((t) => ({ label: t.name, value: SUBMITTED.filter((p) => p.trackId === t.id).length }));

  return (
    <>
      <PageHeader eyebrow="Organizer analytics" title="Analytics" meta={<><span>Live · local</span><span>{done.length} scores</span><span>{SUBMITTED.length} submissions</span></>} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame title="Submission timeline" meta="Cumulative">
          <AreaChart data={SUBMISSION_TIMELINE} caption="Cumulative submissions by 6-hour window" />
        </ChartFrame>
        <ChartFrame title="Judge completion" meta="% of assignments">
          <BarChart caption="Judge completion rate" format={(v) => `${Math.round(v)}%`}
            data={JUDGES.map((j) => { const s = judgeStats(j.id); return { label: j.id.replace("JUDGE_", "J"), value: (s.completed / s.assigned) * 100 }; })} />
        </ChartFrame>
        <ChartFrame title="Score distribution" meta="Normalized · per project">
          <BarChart caption="Distribution of normalized project scores" data={dist} />
        </ChartFrame>
        <ChartFrame title="Criterion averages" meta="Raw · all judges">
          <HBars caption="Average score per rubric criterion" data={criterionAvg} max={10} format={(v) => v.toFixed(2)} className="pt-2" />
        </ChartFrame>
        <ChartFrame title="Normalization impact" meta="Top 10" className="xl:col-span-2">
          <PairedBars caption="Raw versus normalized mean score" series={["Raw", "Normalized"]} domain={[5, 10]}
            data={LEADERBOARD.slice(0, 10).map((r) => ({ label: `P-${pad(r.project.id)} ${r.project.name}`, a: r.raw, b: r.normalized }))} />
        </ChartFrame>
        <ChartFrame title="Voting activity" meta="Votes / hour · UTC">
          <AreaChart data={VOTING_ACTIVITY} caption="Community votes per hour" />
        </ChartFrame>
        <ChartFrame title="Submissions by track">
          <HBars caption="Submissions per track" data={byTrack} max={Math.max(...byTrack.map((b) => b.value))} className="pt-2" />
        </ChartFrame>
      </div>
    </>
  );
}

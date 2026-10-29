"use client";

import { useEffect, useState } from "react";
import { api, type MathStats } from "@/lib/api";
import { Badge, Panel, Skeleton } from "@/components/ui/primitives";

// Shows the discrete-maths numbers behind judging (GET /api/judging/math).
// See backend/src/discrete.js for the formulas.

function useMath(eventId: number, refresh: number) {
  const [m, setM] = useState<MathStats | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setError(undefined);
    api.getMath(eventId).then(setM).catch((e: Error) => setError(e.message));
  }, [eventId, refresh]);
  return { m, error };
}

// Large BigInt strings (e.g. 30!) are shortened to scientific notation.
const big = (s: string) => (s.length > 12 ? `${s[0]}.${s.slice(1, 3)}e${s.length - 1}` : Number(s).toLocaleString());

function Stat({ label, formula, value }: { label: string; formula: string; value: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-line bg-white/[0.015] p-3">
      <p className="label">{label}</p>
      <p className="mt-1.5 font-mono text-xl font-semibold">{value}</p>
      <p className="mt-1 font-mono text-[11px] text-muted">{formula}</p>
    </div>
  );
}

export function MathStatsPanel({ eventId, refresh }: { eventId: number; refresh: number }) {
  const { m, error } = useMath(eventId, refresh);
  if (error) return <Panel title="Discrete maths"><p className="p-4 text-sm text-muted">{error}</p></Panel>;
  if (!m) return <Skeleton className="h-48" />;
  const { counting: c, combinatorics: x, recurrences: r, graph: g, logic } = m;
  const checks: [string, boolean][] = [
    ["Every project has k judges", logic.every_project_covered],
    ["No judge reviews own team", logic.no_conflicts],
    ["Load ≤ workload cap", logic.within_workload_cap],
    ["No duplicate pairs", logic.no_duplicates],
  ];
  return (
    <Panel title="Discrete maths" meta={`J=${m.judges} · P=${m.projects} · k=${m.k}`} bodyClassName="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Panels per project" formula="C(J, k)" value={big(c.panels_per_project)} />
        <Stat label="Possible rankings" formula="P!" value={big(c.possible_rankings)} />
        <Stat label="Possible assignments" formula="C(J, k)^P" value={big(c.possible_assignments)} />
        <Stat label="Workload cap" formula="⌈P·k / J⌉ (pigeonhole)" value={x.workload_cap} />
        <Stat label="Valid panels (worst project)" formula="Σ(−1)ⁱ C(c,i) C(J−i,k−i)" value={big(x.min_valid_panels)} />
        <Stat label="Judge derangements" formula="D(J) = (J−1)(D(J−1)+D(J−2))" value={big(x.derangements_of_judges)} />
        <Stat label="Elimination rounds" formula="R(n) = 1 + R(⌈n/2⌉)" value={r.elimination_round_count} />
        <Stat label="Time slots (colours)" formula="greedy graph colouring" value={g.time_slots} />
      </div>
      <div>
        <p className="label mb-2">Logic checks on current assignment</p>
        <div className="flex flex-wrap gap-2">
          {checks.map(([label, ok]) => <Badge key={label} tone={ok ? "ok" : "warn"} dot>{label}: {ok ? "true" : "false"}</Badge>)}
        </div>
      </div>
      <p className="font-mono text-[11px] text-muted">Matching: bipartite max-flow · Rotation: {m.modular.rule}</p>
    </Panel>
  );
}

export function EliminationRounds({ eventId }: { eventId: number }) {
  const { m, error } = useMath(eventId, 0);
  if (error) return null;
  if (!m) return <Skeleton className="h-40" />;
  const rounds = m.recurrences.elimination_rounds;
  if (rounds[0].length === 0) return null;
  const name = (i: number) => (i === rounds.length - 1 ? "Final" : `Round ${i + 1}`);
  return (
    <Panel title="Elimination rounds" meta={`R(${rounds[0].length}) = ${m.recurrences.elimination_round_count}`} bodyClassName="overflow-x-auto p-4">
      <div className="flex gap-3">
        {rounds.map((round, i) => (
          <div key={i} className="min-w-44 flex-1">
            <p className="label mb-2">{name(i)} · {round.length}</p>
            <ol className="space-y-1.5">
              {round.map((p) => (
                <li key={p.submission_id} className="truncate rounded-xs border border-line px-2.5 py-1.5 text-[13px]">{p.title || "Untitled"}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted">Top half (rounded up) of the normalized ranking advances each round.</p>
    </Panel>
  );
}
